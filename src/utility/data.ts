import Driver from "nekostore/lib/Driver";
import DocumentSnapshot from "nekostore/lib/DocumentSnapshot";
import {ApplicationError} from "../error/ApplicationError";
import {PERMISSION_DEFAULT} from "../server";
import {findList, findSingle, getData, getMaxOrder, getOwner, splitCollectionName} from "./collection";
import DocumentChange from "nekostore/src/DocumentChange";
import uuid from "uuid";
import {procAsyncSplit} from "./async";
import {deleteDataPackage} from "../event/delete-data-package";
const matchAll = require("match-all");

export async function touchCheck<T>(
  driver: Driver,
  collectionName: string,
  key: string
): Promise<DocumentSnapshot<StoreData<T>>> {
  const msgArg = { collectionName, key };
  const docSnap = await getData<T>(driver, collectionName, { key });

  // No such check.
  if (!docSnap || !docSnap.exists()) throw new ApplicationError(`No such.`, msgArg);

  // Already check.
  if (docSnap.data.exclusionOwner) throw new ApplicationError(`Already touched.`, msgArg);

  return docSnap;
}

export async function multipleTouchCheck(driver: Driver, collectionName: string, whereStr: string, value: string): Promise<DocumentChange<StoreData<any>>[]> {
  const docs = (await findList<StoreData<any>>(driver, collectionName, [{ property: whereStr, operand: "==", value }]))!;
  const lockingDocs = docs.filter(d => d.data!.exclusionOwner);
  if (lockingDocs.length) {
    throw new ApplicationError(`Already touched.`, { collectionName, keyList: lockingDocs.map(doc => doc.data!.key ) });
  }
  return docs;
}

async function getAllReference(
  driver: Driver,
  roomCollectionPrefix: string,
  type: string,
  key: string
): Promise<DataReference[]> {
  const refList: DataReference[] = [];

  if (type === "media-list") {
    const regExp = new RegExp(`"mediaKey": ?"${key}"`, "g");
    [
      "scene-object-list",
      "scene-list",
      "public-memo-list",
      "resource-master-list"
    ].map(async suffix => {
      (await driver.collection<StoreData<any>>(`${roomCollectionPrefix}-DATA-${suffix}`).get())
        .docs
        .forEach(doc => {
          if (!doc.exists()) return;
          const str = JSON.stringify(doc.data.data);
          const matchResult = str.match(regExp);
          if (!matchResult) return;
          refList.push({
            type: suffix,
            key: doc.data.key
          });
        });
    })
  }

  return refList;
}

async function updateMediaKeyRefList<T>(
  driver: Driver,
  roomCollectionPrefix: string,
  data: T,
  type: string,
  key: string,
  operation: "add" | "delete" | "update",
  originalData?: T
): Promise<void> {
  const regExp = new RegExp(`"mediaKey": ?"([^"]+)"`, "g");
  const mediaListCollectionName = `${roomCollectionPrefix}-DATA-media-list`;

  const mediaKeyList: string[] = matchAll(JSON.stringify(data), regExp)
    .toArray()
    .filter(
      (mediaKey: string, index: number, list: string[]) =>
        list.findIndex(
          l => l === mediaKey
        ) === index
    );

  const simple = async (operation: "add" | "delete", mediaKeyList: string[]): Promise<void> => {
    if (!mediaKeyList.length) return;
    await Promise.all(
      mediaKeyList.map(async mediaKey => {
        const doc = await getData(driver, mediaListCollectionName, { key: mediaKey });
        if (operation === "add") {
          await addRefList(doc, type, key);
        } else {
          await deleteRefList(doc, type, key);
        }
      })
    );
  };

  if (operation !== "update") {
    return await simple(operation, mediaKeyList);
  }

  const originalMediaKeyList: string[] = matchAll(JSON.stringify(originalData), regExp)
    .toArray()
    .filter(
      (mediaKey: string, index: number, list: string[]) =>
        list.findIndex(
          l => l === mediaKey
        ) === index
    );

  await simple("delete", originalMediaKeyList.filter(
    originalKey => !mediaKeyList.some(key => key === originalKey)
  ));
  await simple("add", mediaKeyList.filter(
    key => !originalMediaKeyList.some(originalKey => originalKey === key)
  ));
}

async function addRefList(doc: DocumentSnapshot<StoreData<any>> | null, type: string, key: string) {
  if (!doc || !doc.exists()) return;
  doc.data.refList.push({ type, key });
  await doc.ref.update({ refList: doc.data.refList });
}

async function deleteRefList(doc: DocumentSnapshot<StoreData<any>> | null, type: string, key: string) {
  if (!doc || !doc.exists()) return;
  const index = doc.data.refList.findIndex(ref =>
    ref.type === type && ref.key === key
  );
  if (index > -1) {
    doc.data.refList.splice(index, 1);
    await doc.ref.update({ refList: doc.data.refList });
  }
}

export async function addSimple<T>(
  driver: Driver,
  socket: any,
  collectionName: string,
  data: Partial<StoreData<T>> & { data: T }
): Promise<DocumentSnapshot<StoreData<T>> | null> {
  const { c, maxOrder } = await getMaxOrder<T>(driver, collectionName);
  const exclusionOwner = socket.id;

  if (data.key !== undefined) {
    if (await findSingle(driver, collectionName, "key", data.key)) return null;
  }

  const { roomCollectionPrefix, roomCollectionSuffix } = splitCollectionName(collectionName);
  data.collection = roomCollectionSuffix;
  const ownerType = data.ownerType !== undefined ? data.ownerType : "user-list";
  const owner = await getOwner(driver, exclusionOwner, data.owner);
  const order = data.order !== undefined ? data.order : maxOrder + 1;
  const now = new Date();
  const permission = data.permission || PERMISSION_DEFAULT;
  const key = data.key !== undefined ? data.key : uuid.v4();
  const refList: DataReference[] = [];

  if (ownerType && owner) {
    if (ownerType === "user-list") {
      const ownerDoc = await getData(
        driver,
        `${roomCollectionPrefix}-DATA-${ownerType}`,
        { key: owner }
      );
      await addRefList(ownerDoc, data.collection, key);
    }
  }

  await updateMediaKeyRefList<T>(
    driver,
    roomCollectionPrefix,
    data.data,
    roomCollectionSuffix,
    key,
    "add"
  );

  refList.push(...await getAllReference(
    driver,
    roomCollectionPrefix,
    roomCollectionSuffix,
    key
  ));

  const addInfo: StoreData<T> = {
    collection: roomCollectionSuffix,
    key,
    order,
    ownerType,
    owner,
    exclusionOwner: null,
    lastExclusionOwner: null,
    permission,
    status: "added",
    createTime: now,
    updateTime: now,
    refList,
    data: data.data
  };

  try {
    return await (await c.add(addInfo)).get();
  } catch (err) {
    throw new ApplicationError(`Failure add doc.`, addInfo);
  }
}

export async function getDataForDelete(
  driver: Driver,
  collectionName: string,
  key: string
): Promise<DocumentSnapshot<StoreData<any>>> {
  const msgArg = { collectionName, key };
  const doc = await getData(driver, collectionName, { key });
  if (!doc) throw new ApplicationError(`Untouched data.`, msgArg);
  const data = doc.data;
  if (!data || !data.data) throw new ApplicationError(`Already deleted.`, msgArg);
  return doc;
}

export async function deleteSimple<T>(
  driver: Driver,
  _: any,
  collectionName: string,
  key: string
): Promise<StoreData<T>> {
  const { roomCollectionPrefix, roomCollectionSuffix } = splitCollectionName(collectionName);
  const msgArg = { collectionName, key };
  const doc: DocumentSnapshot<StoreData<any>> = await getDataForDelete(driver, collectionName, key);
  const data = doc.data!;

  const ownerType = data.ownerType;
  const ownerKey = data.owner;
  if (ownerType === "user-list" && ownerKey) {
    const ownerDoc = await getData<any>(
      driver,
      `${roomCollectionPrefix}-DATA-${ownerType}`,
      { key: ownerKey }
    );
    await deleteRefList(ownerDoc, data.collection, key);
  }

  // データ中にmedia-listへの参照を含んでいた場合はmedia-listの参照情報を削除する
  await updateMediaKeyRefList<T>(
    driver,
    roomCollectionPrefix,
    data.data,
    roomCollectionSuffix,
    key,
    "delete"
  );

  try {
    await doc.ref.delete();
  } catch (err) {
    throw new ApplicationError(`Failure delete doc.`, msgArg);
  }

  return data;
}

export async function updateSimple<T>(
  driver: Driver,
  _: any,
  collectionName: string,
  data: (Partial<StoreData<T>> & { key: string; continuous?: boolean; })
): Promise<void> {
  const { roomCollectionPrefix, roomCollectionSuffix } = splitCollectionName(collectionName);
  const msgArg = { collectionName, data };
  const doc = await getData(driver, collectionName, { key: data.key });

  // No such check.
  if (!doc || !doc.exists() || !doc.data.data)
    throw new ApplicationError(`No such data.`, msgArg);

  const updateInfo: Partial<StoreData<any>> = {
    status: "modified",
    updateTime: new Date()
  };

  if (doc.data.ownerType && doc.data.owner) {
    const originalOwnerRef: DataReference = { type: doc.data.ownerType, key: doc.data.owner };
    const newOwnerRef: DataReference = { type: doc.data.ownerType, key: doc.data.owner };
    let isDeleteRefList: boolean = false;
    let isAddRefList: boolean = false;

    if (data.ownerType !== undefined && data.ownerType !== doc.data.ownerType) {
      newOwnerRef.type = data.ownerType!;
      isDeleteRefList = originalOwnerRef.type === "user-list";
      isAddRefList = newOwnerRef.type === "user-list";
    }
    if (data.owner !== undefined && data.owner !== doc.data.owner) {
      newOwnerRef.key = data.key!;
      isDeleteRefList = originalOwnerRef.type === "user-list";
      isAddRefList = newOwnerRef.type === "user-list";
    }
    if (isDeleteRefList) {
      const originalOwner = await getData(
        driver,
        `${roomCollectionPrefix}-DATA-${originalOwnerRef.type}`,
        { key: originalOwnerRef.key }
      );
      await deleteRefList(originalOwner, roomCollectionSuffix, data.key);
    }
    if (isAddRefList) {
      const newOwner = await getData(
        driver,
        `${roomCollectionPrefix}-DATA-${newOwnerRef.type}`,
        { key: newOwnerRef.key }
      );
      await addRefList(newOwner, roomCollectionSuffix, data.key)
    }
  }

  if (data.permission !== undefined) updateInfo.permission = data.permission;
  if (data.order !== undefined) updateInfo.order = data.order || 0;
  if (data.owner !== undefined) updateInfo.owner = data.owner;
  if (data.ownerType !== undefined) updateInfo.ownerType = data.ownerType;
  if (data.data !== undefined) {
    updateInfo.data = data.data;

    await updateMediaKeyRefList(
      driver,
      roomCollectionPrefix,
      data.data,
      roomCollectionSuffix,
      data.key,
      "update",
      doc.data.data
    );
  }
  try {
    await doc.ref.update(updateInfo);
  } catch (err) {
    throw new ApplicationError(`Failure update doc.`, updateInfo);
  }
}

export class RelationalDataDeleter {
  constructor(
    private driver: Driver,
    private roomCollectionPrefix: string,
    private key: string
  ) {}

  public async deleteForce(
    collectionSuffix: string,
    targetProperty: string
  ): Promise<void> {
    await procAsyncSplit(
      (await findList<StoreData<any>>(
          this.driver,
          `${this.roomCollectionPrefix}-DATA-${collectionSuffix}`,
          [{ property: targetProperty, operand: "==", value: this.key }])
      ).map(doc => doc.ref.delete())
    );
  }

  private relationList: { ccName: string; targetProperty: string; }[] = [];

  public addRelation(
    collectionSuffix: string,
    targetProperty: string
  ): RelationalDataDeleter {
    this.relationList.push({
      ccName: `${this.roomCollectionPrefix}-DATA-${collectionSuffix}`,
      targetProperty
    });
    return this;
  }

  public async allDelete(socket: any) {
    const changeInfoList: {
      documentChangeList: DocumentChange<StoreData<any>>[];
      ccName: string;
    }[] = [];

    const checker = async (relation: { ccName: string; targetProperty: string; }): Promise<void> => {
      changeInfoList.push({
        documentChangeList: await multipleTouchCheck(
          this.driver,
          relation.ccName,
          relation.targetProperty,
          this.key
        ),
        ccName: relation.ccName
      });
    };

    // 非同期処理で順次消していく
    await this.relationList
      .map(data => () => checker(data))
      .reduce((prev, curr) => prev.then(curr), Promise.resolve());

    // 非同期処理で順次消していく
    await changeInfoList
      .map(data => () => deleteDataPackage(this.driver, socket, {
        collection: data.ccName,
        list: data.documentChangeList.map(d => ({ key: d.data!.key }))
      }))
      .reduce((prev, curr) => prev.then(curr), Promise.resolve());
  }
}
