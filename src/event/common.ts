import Driver from "nekostore/lib/Driver";
import DocumentSnapshot from "nekostore/lib/DocumentSnapshot";
import {Permission, StoreMetaData, StoreObj} from "../@types/store";
import {hashAlgorithm, SYSTEM_COLLECTION} from "../server";
import {SystemError} from "../error/SystemError";
import {
  UserLoginResponse,
  UserType
} from "../@types/socket";
import {ApplicationError} from "../error/ApplicationError";
import CollectionReference from "nekostore/src/CollectionReference";
import DocumentChange from "nekostore/lib/DocumentChange";
import Query from "nekostore/lib/Query";
import {hash} from "../utility/password";
import uuid = require("uuid");
import {accessLog, errorLog} from "../utility/logger";
import {ActorGroup, RoomStore, SocketStore, TouchierStore, UserStore} from "../@types/data";

/**
 * リクエスト処理を登録するための関数。
 * @param driver
 * @param socket
 * @param eventName
 * @param func
 */
export function setEvent<T, U>(driver: Driver, socket: any, eventName: string, func: (driver: Driver, arg: T, permission?: Permission) => Promise<U>) {
  const resultEvent = `result-${eventName}`;
  socket.on(eventName, async (arg: T) => {
    accessLog(socket.id, eventName, "START", arg);
    try {
      const result = await func(driver, arg);
      accessLog(socket.id, eventName, "END  ", result);
      socket.emit(resultEvent, null, result);
    } catch (err) {
      // アクセスログは必ず閉じる
      accessLog(socket.id, eventName, "ERROR");

      // エラーの内容はエラーログを見て欲しい（アクセスログはシンプルにしたい）
      const errorMessage = "message" in err ? err.message : err;
      errorLog(socket.id, eventName, errorMessage);

      socket.emit(resultEvent, err, null);
    }
  });
}

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

type GetRoomInfoOption = {
  exclusionOwner?: string;
  id?: string;
  collectionReference?: CollectionReference<StoreObj<RoomStore>>;
};

/**
 * 部屋情報コレクションから特定の部屋の情報を取得する
 * @param driver
 * @param roomNo
 * @param option
 */
export async function getRoomInfo(
  driver: Driver,
  roomNo: number,
  option: GetRoomInfoOption = {}
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
  option: GetRoomInfoOption = {}
): Promise<DocumentSnapshot<StoreObj<any>> | null> {
  const collectionReference = option.collectionReference || driver.collection<StoreObj<any>>(collection);
  const docSnap = (await collectionReference.doc(id).get());

  if (!docSnap || !docSnap.exists()) return null;

  // 排他チェック
  if (option.exclusionOwner !== undefined) {
    const data = docSnap.data;
    if (!data.exclusionOwner)
      throw new ApplicationError(
        `Failure getRoomInfo. (Target roomInfo document has not exclusionOwner.)`,
        { collection, id }
      );
    if (data.exclusionOwner !== option.exclusionOwner)
      throw new ApplicationError(
        `Failure getRoomInfo. (Already touched.)`,
        { collection, id }
      );
  }
  return docSnap;
}

export async function checkViewer(driver: Driver, exclusionOwner: string): Promise<boolean> {
  const viewerInfo = (await getSocketDocSnap(driver, exclusionOwner)).data!;
  return !(viewerInfo && viewerInfo.roomId && viewerInfo.userId);
}

export async function addUser(
  driver: Driver,
  exclusionOwner: string,
  roomCollectionPrefix: string,
  userName: string,
  userPassword: string,
  userType: UserType
): Promise<UserLoginResponse> {
  const roomUserCollectionName = `${roomCollectionPrefix}-DATA-user-list`;
  const userCollection = driver.collection<StoreObj<UserStore>>(roomUserCollectionName);
  const actorGroupCollectionName = `${roomCollectionPrefix}-DATA-actor-group-list`;
  const actorGroupCollection = driver.collection<StoreObj<ActorGroup>>(actorGroupCollectionName);
  const socketDocSnap = (await getSocketDocSnap(driver, exclusionOwner));

  userPassword = await hash(userPassword, hashAlgorithm);

  const token = uuid.v4();

  const userDocRef = await userCollection.add({
    order: -1,
    exclusionOwner: null,
    owner: null,
    status: "added",
    createTime: new Date(),
    updateTime: null,
    data: {
      userName,
      userPassword,
      token,
      userType,
      login: 1
    },
    permission: {
      view: {
        type: "none",
        list: []
      },
      edit: {
        type: "none",
        list: []
      },
      chmod: {
        type: "none",
        list: []
      }
    }
  });

  const userId = userDocRef.id;

  await socketDocSnap.ref.update({
    userId
  });

  const addGroup = async (name: string) => {
    const groupDoc = (await actorGroupCollection.where("data.name", "==", name).get()).docs[0];
    const data: ActorGroup = groupDoc.data!.data!;
    data.list.push({
      type: "user",
      id: userId
    });
    await groupDoc.ref.update({
      data
    });
  };
  await addGroup("All");
  await addGroup("Users");
  if (userType === "PL") await addGroup("Players");
  if (userType === "GM") await addGroup("GameMasters");
  if (userType === "VISITOR") await addGroup("Visitors");

  return {
    userId,
    token
  };
}

export async function addTouchier(
  driver: Driver,
  socketId: string,
  collection: string,
  id: string
): Promise<void> {
  const c = driver.collection<TouchierStore>(SYSTEM_COLLECTION.TOUCH_LIST);
  const doc: DocumentChange<TouchierStore> = (await c
    .where("socketId", "==", socketId)
    .where("collection", "==", collection)
    .where("id", "==", id)
    .get()).docs[0];
  if (doc) {
    // あり得ないけど一応存在チェック
    throw new SystemError(`Touchier is Exist. collection: ${collection}, id: ${id}, socketId: ${socketId}`);
  }
  await c.add({
    socketId, collection, docId: id, time: new Date()
  });
}

export async function deleteTouchier(
  driver: Driver,
  socketId: string,
  collection?: string,
  id?: string
): Promise<void> {
  const c = driver.collection<TouchierStore>(SYSTEM_COLLECTION.TOUCH_LIST);
  let q: Query<TouchierStore> = c.where("socketId", "==", socketId);
  if (collection !== undefined)
    q = q.where("collection", "==", collection);
  if (id !== undefined)
    q = q.where("docId", "==", id);
  const docList: DocumentChange<TouchierStore>[] = (await q.get()).docs;
  if (!docList || !docList.length) {
    console.warn(`deleteTouchier失敗 socket: ${socketId}, collection: ${collection}, id: ${id}`);
    return;
  }

  const deleteList = async (doc: DocumentSnapshot<TouchierStore>): Promise<void> => {
    await doc.ref.delete();
  };
  await docList
    .map((doc: DocumentSnapshot<TouchierStore>) => () => deleteList(doc))
    .reduce((prev, curr) => prev.then(curr), Promise.resolve());
}

export async function releaseTouch(
  driver: Driver,
  socketId: string,
  collection?: string,
  id?: string
): Promise<void> {
  const c = driver.collection<TouchierStore>(SYSTEM_COLLECTION.TOUCH_LIST);
  let q: Query<TouchierStore> = c.where("socketId", "==", socketId);
  if (collection !== undefined)
    q = q.where("collection", "==", collection);
  if (id !== undefined)
    q = q.where("id", "==", id);
  const docList: DocumentChange<TouchierStore>[] = (await q.get()).docs;
  if (!docList || !docList.length) return;
  docList.forEach(async doc => {
    if (doc.exists()) {
      const { collection, docId } = doc.data;
      const targetCollection = driver.collection<StoreObj<any>>(collection);
      const target = await targetCollection.doc(docId).get();
      if (target.exists()) {
        if (target.data.data) {
          await target.ref.update({
            exclusionOwner: null
          });
        } else {
          await target.ref.delete();
        }
      }
    }
    await doc.ref.delete();
  });
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
