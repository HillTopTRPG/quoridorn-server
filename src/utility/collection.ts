import DocumentSnapshot from "nekostore/lib/DocumentSnapshot";
import {GetDataOption, StoreMetaData, StoreObj} from "../@types/store";
import Driver from "nekostore/lib/Driver";
import {RoomStore, SocketStore} from "../@types/data";
import {SYSTEM_COLLECTION} from "../server";
import {SystemError} from "../error/SystemError";
import {ApplicationError} from "../error/ApplicationError";
import CollectionReference from "nekostore/src/CollectionReference";


export function getStoreObj<T>(
  doc: DocumentSnapshot<StoreObj<T>>
): (StoreObj<T> & StoreMetaData) | null {
  if (doc.exists()) {
    const data: StoreObj<T> = doc.data;
    return {
      ...data,
      id: doc.ref.id,
    };
  } else {
    return null;
  }
}

export async function resistCollectionName(driver: Driver, collection: string) {
  const roomCollectionPrefix = collection.replace(/-DATA-.+$/, "");
  const collectionListCollectionName = `${roomCollectionPrefix}-DATA-collection-list`;
  const cnCC = driver.collection<{ name: string }>(collectionListCollectionName);
  if ((await cnCC.where("name", "==", collection).get()).docs.length) return;
  await cnCC.add({ name: collection });
}

/**
 * 部屋情報コレクションから特定の部屋の情報を取得する
 * @param driver
 * @param roomNo
 * @param option
 */
export async function getRoomInfo(
  driver: Driver,
  roomNo: number,
  option: GetDataOption<RoomStore> = {}
): Promise<DocumentSnapshot<StoreObj<RoomStore>> | null> {
  const collectionReference = option.collectionReference || driver.collection<StoreObj<RoomStore>>(SYSTEM_COLLECTION.ROOM_LIST);
  const roomDocList = (await collectionReference.where("order", "==", roomNo).get()).docs;

  if (!roomDocList.length) return null;

  // 部屋情報が複数件取得できてしまった場合
  // 仕様上考慮しなくていいとされてきたuuidが重複してしまった本当の想定外エラー
  if (roomDocList.length > 1)
    throw new SystemError(`Duplicate room info. Please report to server administrator. room-no=${roomNo}`);

  // 排他チェック
  if (option.exclusionOwner !== undefined) {
    const data = roomDocList[0].data!;
    if (!data.exclusionOwner)
      throw new ApplicationError(
        `Failure getRoomInfo. (Target roomInfo document has not exclusionOwner.)`,
        { roomNo }
      );
    if (data.exclusionOwner !== option.exclusionOwner)
      throw new ApplicationError(
        `Failure getRoomInfo. (Already touched.)`,
        { roomNo }
      );
  }

  // idチェック
  if (option.id !== undefined && option.id !== roomDocList[0].ref.id) {
    throw new ApplicationError(
      `Failure getRoomInfo. (Request id is not match stored id.)`,
      { roomNo, "storeId": roomDocList[0].ref.id, requestId: option.id }
    );
  }

  return roomDocList[0];
}

/**
 * コレクションから特定の情報を取得する
 * @param driver
 * @param collection
 * @param id
 * @param option
 */
export async function getData(
  driver: Driver,
  collection: string,
  id: string,
  option: GetDataOption<any> = {}
): Promise<DocumentSnapshot<StoreObj<any>> | null> {
  const collectionReference = option.collectionReference || driver.collection<StoreObj<any>>(collection);
  const docSnap = (await collectionReference.doc(id).get());

  if (!docSnap || !docSnap.exists()) return null;

  // 排他チェック
  if (option.exclusionOwner !== undefined) {
    const data = docSnap.data;
    if (!data.exclusionOwner)
      throw new ApplicationError(
        `Failure getData. (Target data document has not exclusionOwner.)`,
        { collection, id }
      );
    if (data.exclusionOwner !== option.exclusionOwner)
      throw new ApplicationError(
        `Failure getData. (Already touched.)`,
        { collection, id }
      );
  }
  return docSnap;
}

export async function checkViewer(driver: Driver, exclusionOwner: string): Promise<boolean> {
  const viewerInfo = (await getSocketDocSnap(driver, exclusionOwner)).data!;
  return !(viewerInfo && viewerInfo.roomId && viewerInfo.userId);
}

export async function getSocketDocSnap(driver: Driver, socketId: string): Promise<DocumentSnapshot<SocketStore>> {
  const socketDocSnap = (await driver.collection<SocketStore>(SYSTEM_COLLECTION.SOCKET_LIST)
    .where("socketId", "==", socketId)
    .get())
    .docs
    .filter(doc => doc && doc.exists())[0];

  // No such socket check.
  if (!socketDocSnap) throw new ApplicationError(`No such socket.`, { socketId });

  return socketDocSnap;
}

export async function getMaxOrder<T>(driver: Driver, collectionName: string): Promise<{ c: CollectionReference<StoreObj<T>>, maxOrder: number }> {
  const c = driver.collection<StoreObj<T>>(collectionName);

  const docs = (await c
  .orderBy("order", "desc")
  .get())
  .docs
  .filter(doc => doc && doc.exists());

  const maxOrder = !docs.length ? -1 : docs[0].data!.order;

  return {
    c, maxOrder
  }
}

export async function getOwner(driver: Driver, socketId: string, owner: string | null | undefined): Promise<string | null> {
  if (owner !== undefined) return owner;
  const socketDocSnap = (await getSocketDocSnap(driver, socketId));
  const userId = socketDocSnap.data!.userId;

  // No such user check.
  if (!userId) throw new ApplicationError(`No such user.`, { socketId });

  return userId;
}
