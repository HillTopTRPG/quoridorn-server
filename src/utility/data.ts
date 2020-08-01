import Driver from "nekostore/lib/Driver";
import DocumentSnapshot from "nekostore/lib/DocumentSnapshot";
import {StoreObj} from "../@types/store";
import {ApplicationError} from "../error/ApplicationError";
import DocumentReference from "nekostore/src/DocumentReference";
import {PERMISSION_DEFAULT} from "../server";
import {getData, getMaxOrder, getOwner} from "./collection";
import DocumentChange from "nekostore/src/DocumentChange";

export async function touchCheck(
  driver: Driver,
  collectionName: string,
  id: string
): Promise<DocumentSnapshot<StoreObj<any>>> {
  const msgArg = { collectionName, id };
  const docSnap = await getData(driver, collectionName, id);

  // No such check.
  if (!docSnap || !docSnap.exists()) throw new ApplicationError(`No such.`, msgArg);

  // Already check.
  if (docSnap.data.exclusionOwner) throw new ApplicationError(`Already touched.`, msgArg);

  return docSnap;
}

export async function multipleTouchCheck(driver: Driver, collectionName: string, whereStr: string, id: string): Promise<DocumentChange<StoreObj<any>>[]> {
  const collection = driver.collection<StoreObj<any>>(collectionName);
  const docChangeList = (await collection.where(whereStr, "==", id).get()).docs;
  const noSuchDocChangeList = docChangeList.filter(rdc => !rdc || !rdc.exists());
  const touchedDocChangeList = docChangeList.filter(rdc => rdc && rdc.exists() && rdc.data.exclusionOwner);
  if (noSuchDocChangeList.length) {
    throw new ApplicationError(`No such.`, { collectionName, idList: noSuchDocChangeList.map(nr => nr.ref.id) });
  }
  if (touchedDocChangeList.length) {
    throw new ApplicationError(`Already touched.`, { collectionName, idList: touchedDocChangeList.map(nr => nr.ref.id) });
  }
  return docChangeList;
}

export async function addSimple<T>(
  driver: Driver,
  socket: any,
  collectionName: string,
  data: T,
  option?: Partial<StoreObj<T>>
): Promise<DocumentReference<StoreObj<T>>> {
  const { c, maxOrder } = await getMaxOrder<T>(driver, collectionName);
  const exclusionOwner = socket.id;

  const ownerType = option && option.ownerType !== undefined ? option.ownerType : "user";
  const owner = await getOwner(driver, exclusionOwner, option ? option.owner : undefined);
  const order = option && option.order !== undefined ? option.order : maxOrder + 1;
  const now = new Date();
  const permission = option && option.permission || PERMISSION_DEFAULT;

  const addInfo: StoreObj<T> = {
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
    return await c.add(addInfo);
  } catch (err) {
    throw new ApplicationError(`Failure add doc.`, addInfo);
  }
}

export async function getDataForDelete(driver: Driver, collectionName: string, id: string): Promise<DocumentSnapshot<StoreObj<any>>> {
  const msgArg = { collectionName, id };
  const docSnap: DocumentSnapshot<StoreObj<any>> | null = await getData(driver, collectionName, id);
  if (!docSnap) throw new ApplicationError(`Untouched data.`, msgArg);
  const data = docSnap.data;
  if (!data || !data.data) throw new ApplicationError(`Already deleted.`, msgArg);
  return docSnap;
}

export async function deleteSimple<T>(
  driver: Driver,
  _: any,
  collectionName: string,
  id: string
): Promise<StoreObj<T>> {
  const msgArg = { collectionName, id };
  const docSnap: DocumentSnapshot<StoreObj<any>> = await getDataForDelete(driver, collectionName, id);
  const data = docSnap.data!;

  try {
    await docSnap.ref.delete();
  } catch (err) {
    throw new ApplicationError(`Failure delete doc.`, msgArg);
  }

  return data;
}

export async function updateSimple(
  driver: Driver,
  _: any,
  collection: string,
  id: string,
  data: any,
  option?: Partial<StoreObj<unknown>> & { continuous?: boolean }
): Promise<void> {
  const msgArg = { collection, id, option };
  const docSnap = await getData(driver, collection, id);

  // No such check.
  if (!docSnap || !docSnap.exists() || !docSnap.data.data) throw new ApplicationError(`No such data.`, msgArg);

  const updateInfo: Partial<StoreObj<any>> = {
    data,
    status: "modified",
    updateTime: new Date()
  };
  if (option) {
    if (option.permission) updateInfo.permission = option.permission;
    if (option.order !== undefined) updateInfo.order = option.order || 0;
    if (option.owner) updateInfo.owner = option.owner;
    if (option.ownerType) updateInfo.ownerType = option.ownerType;
  }
  try {
    await docSnap.ref.update(updateInfo);
  } catch (err) {
    throw new ApplicationError(`Failure update doc.`, updateInfo);
  }
}
