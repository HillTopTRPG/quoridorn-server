import Driver from "nekostore/lib/Driver";
import DocumentSnapshot from "nekostore/lib/DocumentSnapshot";
import {StoreObj} from "../@types/store";
import {ApplicationError} from "../error/ApplicationError";
import {PERMISSION_DEFAULT} from "../server";
import {findList, getData, getMaxOrder, getOwner} from "./collection";
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
  data: T,
  option?: Partial<StoreObj<T>>
): Promise<DocumentSnapshot<StoreObj<T>>> {
  const { c, maxOrder } = await getMaxOrder<T>(driver, collectionName);
  const exclusionOwner = socket.id;

  const collectionSuffixName = collectionName.replace(/^.+-DATA-/, "");
  const ownerType = option && option.ownerType !== undefined ? option.ownerType : "user";
  const owner = await getOwner(driver, exclusionOwner, option ? option.owner : undefined);
  const order = option && option.order !== undefined ? option.order : maxOrder + 1;
  const now = new Date();
  const permission = option && option.permission || PERMISSION_DEFAULT;
  const key = (option ? option.key : null) || uuid.v4();

  const addInfo: StoreObj<T> = {
    collection: collectionSuffixName,
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
    data
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
  data: T,
  option: (Partial<StoreObj<T>> & { key: string; continuous?: boolean; })
): Promise<void> {
  const msgArg = { collection, option };
  const doc = await getData(driver, collection, { key: option.key });

  // No such check.
  if (!doc || !doc.exists() || !doc.data.data)
    throw new ApplicationError(`No such data.`, msgArg);

  const updateInfo: Partial<StoreObj<any>> = {
    data,
    status: "modified",
    updateTime: new Date()
  };
  if (option) {
    if (option.permission !== undefined) updateInfo.permission = option.permission;
    if (option.order !== undefined) updateInfo.order = option.order || 0;
    if (option.owner !== undefined) updateInfo.owner = option.owner;
    if (option.ownerType !== undefined) updateInfo.ownerType = option.ownerType;
  }
  try {
    await doc.ref.update(updateInfo);
  } catch (err) {
    throw new ApplicationError(`Failure update doc.`, updateInfo);
  }
}
