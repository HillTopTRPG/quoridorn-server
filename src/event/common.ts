import Driver from "nekostore/lib/Driver";
import DocumentSnapshot from "nekostore/lib/DocumentSnapshot";
import {Permission, StoreMetaData, StoreObj} from "../@types/store";
import {PERMISSION_DEFAULT, hashAlgorithm, SYSTEM_COLLECTION, PERMISSION_OWNER_CHANGE} from "../server";
import {SystemError} from "../error/SystemError";
import {UploadFileInfo, UserLoginResponse, UserType} from "../@types/socket";
import {ApplicationError} from "../error/ApplicationError";
import CollectionReference from "nekostore/src/CollectionReference";
import DocumentChange from "nekostore/lib/DocumentChange";
import Query from "nekostore/lib/Query";
import {hash} from "../utility/password";
import {accessLog, errorLog} from "../utility/logger";
import {
  ActorGroup,
  ActorStatusStore,
  ActorStore,
  RoomStore,
  SocketStore,
  TouchierStore,
  UserStore
} from "../@types/data";
import uuid = require("uuid");

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
    const logArg = arg ? JSON.parse(JSON.stringify(arg)) : null;
    if (eventName === "upload-file") {
      logArg.forEach((info: UploadFileInfo) => {
        info.src = "[Binary Array]";
      });
    }
    accessLog(socket.id, eventName, "START", logArg);
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

export async function registCollectionName(driver: Driver, collection: string) {
  const roomCollectionPrefix = collection.replace(/-DATA-.+$/, "");
  const collectionNameCollectionName = `${roomCollectionPrefix}-DATA-collection-list`;
  const cnCC = driver.collection<{ name: string }>(collectionNameCollectionName);
  if (!(await cnCC.where("name", "==", collection).get()).docs.length) {
    await cnCC.add({ name: collection });
  }
}

export function notifyProgress(socket: any, all: number, current: number) {
  if (all > 1) socket.emit("notify-progress", null, { all, current });
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

export async function additionalStatus(
  driver: Driver,
  roomCollectionPrefix: string,
  actorId: string
): Promise<string> {
  const statusCollectionName = `${roomCollectionPrefix}-DATA-status-list`;
  const statusResult = await getMaxOrder<ActorStatusStore>(driver, statusCollectionName);
  const statusCollection = statusResult.c;

  const statusDocRef = await statusCollection.add({
    ownerType: "user",
    owner: actorId,
    order: statusResult.maxOrder + 1,
    exclusionOwner: null,
    lastExclusionOwner: null,
    status: "added",
    createTime: new Date(),
    updateTime: null,
    data: {
      name: "◆",
      isSystem: true,
      standImageInfoId: null,
      chatPaletteInfoId: null
    },
    permission: PERMISSION_DEFAULT
  });

  return statusDocRef.id;
}

export async function addActor(
  driver: Driver,
  roomCollectionPrefix: string,
  owner: string | null,
  actorInfoPartial: Partial<ActorStore>
): Promise<string> {
  const actorCollectionName = `${roomCollectionPrefix}-DATA-actor-list`;
  const actorResult = await getMaxOrder<ActorStore>(driver, actorCollectionName);
  const actorCollection = actorResult.c;

  const actorInfo: ActorStore = {
    name: "",
    type: "user",
    tag: "",
    pieceIdList: [],
    chatFontColorType: "original",
    chatFontColor: "#000000",
    standImagePosition: 1,
    statusId: "",
    isUseTableData: false
  };

  const actorDocRef = await actorCollection.add({
    ownerType: "user",
    owner,
    order: actorResult.maxOrder + 1,
    exclusionOwner: null,
    lastExclusionOwner: null,
    status: "added",
    createTime: new Date(),
    updateTime: null,
    data: actorInfo,
    permission: PERMISSION_OWNER_CHANGE
  });

  const actorId = actorDocRef.id;

  const statusId = await additionalStatus(driver, roomCollectionPrefix, actorId);

  const copyParam = <T extends keyof ActorStore>(param: T) => {
    if (actorInfoPartial[param] !== undefined) actorInfo[param] = actorInfoPartial[param] as ActorStore[T];
  };
  actorInfoPartial.statusId = statusId;
  copyParam("name");
  copyParam("type");
  copyParam("chatFontColorType");
  copyParam("chatFontColor");
  copyParam("standImagePosition");
  copyParam("statusId");
  copyParam("isUseTableData");

  await actorDocRef.update({
    status: "modified",
    data: actorInfo,
    updateTime: new Date()
  });

  return actorId;
}

export async function addActorGroup(
  driver: Driver,
  roomCollectionPrefix: string,
  id: string,
  type: "user" | "other",
  userId: string | null,
  groupName: string
): Promise<void> {
  const actorGroupCollectionName = `${roomCollectionPrefix}-DATA-actor-group-list`;
  const actorGroupCollection = driver.collection<StoreObj<ActorGroup>>(actorGroupCollectionName);

  const groupDoc = (await actorGroupCollection.where("data.name", "==", groupName).get()).docs[0];
  const data: ActorGroup = groupDoc.data!.data!;
  data.list.push({
    id,
    type,
    userId
  });
  await groupDoc.ref.update({
    data
  });
}

export async function addUser(
  driver: Driver,
  exclusionOwner: string,
  roomCollectionPrefix: string,
  name: string,
  password: string,
  type: UserType
): Promise<UserLoginResponse> {
  const roomUserCollectionName = `${roomCollectionPrefix}-DATA-user-list`;
  const userCollection = driver.collection<StoreObj<UserStore>>(roomUserCollectionName);

  const socketDocSnap = (await getSocketDocSnap(driver, exclusionOwner));

  password = await hash(password, hashAlgorithm);

  const token = uuid.v4();

  const userDocRef = await userCollection.add({
    ownerType: null,
    owner: null,
    order: -1,
    exclusionOwner: null,
    lastExclusionOwner: null,
    status: "added",
    createTime: new Date(),
    updateTime: null,
    data: {
      name,
      password,
      token,
      type,
      login: 1
    },
    permission: PERMISSION_DEFAULT
  });

  const userId = userDocRef.id;

  await socketDocSnap.ref.update({
    userId
  });

  const actorId: string = await addActor(driver, roomCollectionPrefix, userId, {
    name: name,
    type: "user",
    chatFontColorType: "original",
    chatFontColor: "#000000",
    standImagePosition: 1,
    isUseTableData: false
  });

  const addActorGroupFix = (addActorGroup as Function).bind(
    null,
    driver,
    roomCollectionPrefix,
    actorId,
    "user",
    userId
  );
  await addActorGroupFix("All");
  await addActorGroupFix("Users");
  if (type === "PL") await addActorGroupFix("Players");
  if (type === "GM") await addActorGroupFix("GameMasters");
  if (type === "VISITOR") await addActorGroupFix("Visitors");

  return {
    userId,
    token
  };
}

export async function addTouchier(
  driver: Driver,
  socketId: string,
  collection: string,
  id: string,
  updateTime: Date | null
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
    socketId,
    collection,
    docId: id,
    time: new Date(),
    backupUpdateTime: updateTime
  });
}

export async function deleteTouchier(
  driver: Driver,
  socketId: string,
  collection?: string,
  id?: string
): Promise<Date | null> {
  const c = driver.collection<TouchierStore>(SYSTEM_COLLECTION.TOUCH_LIST);
  let q: Query<TouchierStore> = c.where("socketId", "==", socketId);
  if (collection !== undefined)
    q = q.where("collection", "==", collection);
  if (id !== undefined)
    q = q.where("docId", "==", id);
  const docList: DocumentChange<TouchierStore>[] = (await q.get()).docs;
  if (!docList || !docList.length) {
    console.warn(`deleteTouchier失敗 socket: ${socketId}, collection: ${collection}, id: ${id}`);
    return null;
  }

  const backupUpdateTime = docList[0].data ? docList[0].data.backupUpdateTime : null;

  const deleteList = async (doc: DocumentSnapshot<TouchierStore>): Promise<void> => {
    await doc.ref.delete();
  };
  await docList
    .map((doc: DocumentSnapshot<TouchierStore>) => () => deleteList(doc))
    .reduce((prev, curr) => prev.then(curr), Promise.resolve());

  return backupUpdateTime;
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

function arrayChunk(list: any[], size = 1) {
  // 最初の要素は１つだけ
  return list.reduce((acc, _value, index) => index % size ? acc : [...acc, list.slice(index, index + size)], []);
}

/**
 * 並列に実行したい非同期処理を６つずつまとめて実行する
 * @param promiseList
 */
export async function procAsyncSplit(promiseList: Promise<void>[]) {
  const totalStart = process.hrtime();
  await arrayChunk(promiseList, 6)
    .map((list: Promise<void>[]) => async () => {
      const start = process.hrtime();
      await Promise.all(list);
      const end = process.hrtime(start);
      console.info('  time (hr): %dms', end[1] / 1000000);
    })
    .reduce((prev: Promise<void>, curr: () => Promise<void>) => prev.then(curr), Promise.resolve());
  const totalEnd = process.hrtime(totalStart);
  console.info('Total time (hr): %dms', totalEnd[1] / 1000000);
}
