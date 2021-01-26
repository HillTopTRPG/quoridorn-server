import DocumentSnapshot from "nekostore/lib/DocumentSnapshot";
import Driver from "nekostore/lib/Driver";
import {RoomStore, SocketStore} from "../@types/data";
import {SYSTEM_COLLECTION} from "../server";
import {ApplicationError} from "../error/ApplicationError";
import CollectionReference from "nekostore/src/CollectionReference";
import Query from "nekostore/lib/Query";
import DocumentChange from "nekostore/src/DocumentChange";

type GetDataOption<T> = {
  socketId?: string;
  key?: string;
  collectionReference?: CollectionReference<StoreData<T>>;
};

export function splitCollectionName(collectionName: string): { roomCollectionPrefix: string; roomCollectionSuffix: string } {
  const splitted = collectionName.split("-DATA-");
  return {
    roomCollectionPrefix: splitted[0],
    roomCollectionSuffix: splitted[1] || ""
  };
}

export async function resistCollectionName(driver: Driver, collectionName: string) {
  const { roomCollectionPrefix, roomCollectionSuffix } = splitCollectionName(collectionName);
  const collectionListCollectionName = `${roomCollectionPrefix}-DATA-collection-list`;
  const cnCC = driver.collection<{
    name: string;
    suffix: string;
  }>(collectionListCollectionName);
  if ((await cnCC.where("name", "==", collectionName).get()).docs.length) return;
  await cnCC.add({
    name: collectionName,
    suffix: roomCollectionSuffix
  });
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
): Promise<DocumentChange<StoreData<RoomStore>> | null> {
  const doc = await findSingle<StoreData<RoomStore>>(
    driver,
    SYSTEM_COLLECTION.ROOM_LIST,
    "order",
    roomNo
  );

  if (!doc) return null;

  // 排他チェック
  if (option.socketId !== undefined) {
    const data = doc.data!;
    if (!data.exclusionOwner)
      throw new ApplicationError(
        `Failure getRoomInfo. (Target roomInfo document has not exclusionOwner.)`,
        { roomNo }
      );
    if (data.exclusionOwner !== option.socketId)
      throw new ApplicationError(
        `Failure getRoomInfo. (Already touched.)`,
        { roomNo }
      );
  }

  // keyチェック
  if (option.key !== undefined && option.key !== doc.data!.key) {
    throw new ApplicationError(
      `Failure getRoomInfo. (Request key is not match stored key.)`,
      { roomNo, "storeId": doc.data!.key, requestId: option.key }
    );
  }

  return doc;
}

/*****************************************************************************
 * データを複数件検索する
 * @param driver Driver
 * @param collectionName コレクション名
 * @param options 検索条件
 */
export async function findList<T>(
  driver: Driver,
  collectionName: string,
  options: { property: string; operand: "=="; value: any }[] = []
): Promise<DocumentChange<T>[]> {
  let c: Query<T> = driver.collection<T>(collectionName);
  options.forEach(o => {
    c = c.where(o.property, o.operand, o.value);
  });
  const docs = (await c.get()).docs;
  if (!docs) return [];
  return docs.filter(item => item && item.exists());
}

/*****************************************************************************
 * データを１件取得する
 * @param driver Driver
 * @param collectionName コレクション名
 * @param property 検索プロパティ
 * @param value 検索値
 */
export async function findSingle<T>(
  driver: Driver,
  collectionName: string,
  property: string,
  value: any
): Promise<DocumentChange<T> | null> {
  const list = await findList<T>(
    driver,
    collectionName,
    [{ property, operand: "==", value}]
  );
  return list ? list[0] : null;
}

/**
 * コレクションから特定の情報を取得する
 * @param driver
 * @param collectionName
 * @param option
 */
export async function getData<T>(
  driver: Driver,
  collectionName: string,
  option: GetDataOption<T> = {}
): Promise<DocumentSnapshot<StoreData<T>> | null> {
  const docSnap = await findSingle<StoreData<T>>(
    driver,
    collectionName,
    "key",
    option.key
  );

  if (!docSnap || !docSnap.exists()) return null;

  // 排他チェック
  if (option.socketId !== undefined) {
    const data = docSnap.data;
    if (!data.exclusionOwner)
      throw new ApplicationError(
        `Failure getData. (Target data document has not exclusionOwner.)`,
        { collectionName, key: option.key }
      );
    if (data.exclusionOwner !== option.socketId)
      throw new ApplicationError(
        `Failure getData. (Already touched.)`,
        { collectionName, key: option.key }
      );
  }
  return docSnap;
}

export async function checkViewer(
  driver: Driver,
  socketId: string
): Promise<boolean> {
  const viewerInfo = (await getSocketDocSnap(driver, socketId)).data!;
  return !(viewerInfo && viewerInfo.roomKey && viewerInfo.userKey);
}

export async function getSocketDocSnap(
  driver: Driver,
  socketId: string
): Promise<DocumentSnapshot<SocketStore>> {
  const socketDocSnap = await findSingle<SocketStore>(
    driver,
    SYSTEM_COLLECTION.SOCKET_LIST,
    "socketId",
    socketId
  );

  // No such socket check.
  if (!socketDocSnap) throw new ApplicationError(`No such socket.`, { socketId });

  return socketDocSnap;
}

export async function getMaxOrder<T>(driver: Driver, collectionName: string): Promise<{ c: CollectionReference<StoreData<T>>, maxOrder: number }> {
  const c = driver.collection<StoreData<T>>(collectionName);

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
  const userKey = socketDocSnap.data!.userKey;

  // No such user check.
  if (!userKey) throw new ApplicationError(`No such user.`, { socketId });

  return userKey;
}
