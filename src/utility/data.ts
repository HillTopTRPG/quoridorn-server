import Driver from "nekostore/lib/Driver";
import DocumentSnapshot from "nekostore/lib/DocumentSnapshot";
import {StoreObj} from "../@types/store";
import {ApplicationError} from "../error/ApplicationError";
import {PERMISSION_DEFAULT} from "../server";
import {findList, findSingle, getData, getMaxOrder, getOwner, splitCollectionName} from "./collection";
import DocumentChange from "nekostore/src/DocumentChange";
import uuid from "uuid";

export async function touchCheck<T>(
  driver: Driver,
  collectionName: string,
  key: string
): Promise<DocumentSnapshot<StoreObj<T>>> {
  const msgArg = { collectionName, key };
  const docSnap = await getData<T>(driver, collectionName, { key });

  // No such check.
  if (!docSnap || !docSnap.exists()) throw new ApplicationError(`No such.`, msgArg);

  // Already check.
  if (docSnap.data.exclusionOwner) throw new ApplicationError(`Already touched.`, msgArg);

  return docSnap;
}

export async function multipleTouchCheck(driver: Driver, collectionName: string, whereStr: string, value: string): Promise<DocumentChange<StoreObj<any>>[]> {
  const docs = (await findList<StoreObj<any>>(driver, collectionName, [{ property: whereStr, operand: "==", value }]))!;
  if (docs.length) {
    throw new ApplicationError(`No such.`, { collectionName, keyList: docs.map(doc => doc.data!.key) });
  }
  const lockingDocs = docs.filter(d => d.data!.exclusionOwner);
  if (lockingDocs.length) {
    throw new ApplicationError(`Already touched.`, { collectionName, keyList: lockingDocs.map(doc => doc.data!.key ) });
  }
  return docs;
}

export async function addSimple<T>(
  driver: Driver,
  socket: any,
  collectionName: string,
  data: Partial<StoreObj<T>> & { data: T }
): Promise<DocumentSnapshot<StoreObj<T>> | null> {
  const { c, maxOrder } = await getMaxOrder<T>(driver, collectionName);
  const exclusionOwner = socket.id;

  if (data.key !== undefined) {
    if (await findSingle(driver, collectionName, "key", data.key)) return null;
  }

  const { roomCollectionSuffix } = splitCollectionName(collectionName);
  const ownerType = data.ownerType !== undefined ? data.ownerType : "user";
  const owner = await getOwner(driver, exclusionOwner, data.owner);
  const order = data.order !== undefined ? data.order : maxOrder + 1;
  const now = new Date();
  const permission = data.permission || PERMISSION_DEFAULT;
  const key = data.key !== undefined ? data.key : uuid.v4();

  const addInfo: StoreObj<T> = {
    collection: roomCollectionSuffix,
    key,
    ownerType,
    owner,
    order,
    exclusionOwner: null,
    lastExclusionOwner: null,
    status: "added",
    createTime: now,
    updateTime: now,
    permission,
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
): Promise<DocumentSnapshot<StoreObj<any>>> {
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
): Promise<StoreObj<T>> {
  const msgArg = { collectionName, key };
  const doc: DocumentSnapshot<StoreObj<any>> = await getDataForDelete(driver, collectionName, key);
  const data = doc.data!;

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
  collection: string,
  data: (Partial<StoreObj<T>> & { key: string; continuous?: boolean; })
): Promise<void> {
  const msgArg = { collection, data };
  const doc = await getData(driver, collection, { key: data.key });

  // No such check.
  if (!doc || !doc.exists() || !doc.data.data)
    throw new ApplicationError(`No such data.`, msgArg);

  const updateInfo: Partial<StoreObj<any>> = {
    status: "modified",
    updateTime: new Date()
  };
  if (data.permission !== undefined) updateInfo.permission = data.permission;
  if (data.order !== undefined) updateInfo.order = data.order || 0;
  if (data.owner !== undefined) updateInfo.owner = data.owner;
  if (data.ownerType !== undefined) updateInfo.ownerType = data.ownerType;
  if (data.data !== undefined) updateInfo.data = data.data;
  try {
    await doc.ref.update(updateInfo);
  } catch (err) {
    throw new ApplicationError(`Failure update doc.`, updateInfo);
  }
}
