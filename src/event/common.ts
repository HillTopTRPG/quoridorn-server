import Driver from "nekostore/lib/Driver";
import DocumentSnapshot from "nekostore/lib/DocumentSnapshot";
import {StoreMetaData, StoreObj} from "../@types/store";
import {hashAlgorithm, SYSTEM_COLLECTION} from "../server";
import {SystemError} from "../error/SystemError";
import {
  RoomStore,
  SocketStore,
  TouchierStore,
  UserLoginRequest,
  UserStore
} from "../@types/socket";
import {ApplicationError} from "../error/ApplicationError";
import CollectionReference from "nekostore/src/CollectionReference";
import DocumentChange from "nekostore/lib/DocumentChange";
import {hash, verify} from "../password";
import Query from "nekostore/lib/Query";

export function setEvent<T, U>(driver: Driver, socket: any, event: string, func: (driver: Driver, arg: T) => Promise<U>) {
  const resultEvent = `result-${event}`;
  socket.on(event, async (arg: T) => {
    try {
      socket.emit(resultEvent, null, await func(driver, arg));
    } catch(err) {
      console.error(err);
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
    const data = roomDocList[0].data;
    if (!data.exclusionOwner) throw new ApplicationError(`Illegal operation. room-no=${roomNo}`);
    if (data.exclusionOwner !== option.exclusionOwner) throw new ApplicationError(`Other player touched. room-no=${roomNo}`);
  }

  // idチェック
  if (option.id !== undefined) {
    if (roomDocList[0].ref.id !== option.id) throw new ApplicationError(`Already recreated room. room-no=${roomNo} storeId=${roomDocList[0].ref.id}, room-id=${option.id}`);
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
    if (!data.exclusionOwner) throw new ApplicationError(`Illegal operation. collection=${collection} id=${id}`);
    if (data.exclusionOwner !== option.exclusionOwner) throw new ApplicationError(`Other player touched. collection=${collection} id=${id}`);
  }

  return docSnap;
}

export async function checkViewer(driver: Driver, exclusionOwner: string, isAdd: boolean): Promise<boolean> {
  const c = driver.collection<SocketStore>(SYSTEM_COLLECTION.SOCKET_LIST);
  const viewerInfo: SocketStore | null = (await c
    .where("socketId", "==", exclusionOwner)
    .get()).docs
    .filter(doc => doc.exists())
    .map(doc => doc.data!)[0];

  return !viewerInfo || !viewerInfo.roomId;
}

export async function userLogin(
  driver: Driver,
  socketId: string,
  loginInfo: UserLoginRequest
): Promise<boolean> {
  // 部屋コレクションの取得と部屋存在チェック
  const roomCollection = driver.collection<StoreObj<RoomStore>>(SYSTEM_COLLECTION.ROOM_LIST);
  const roomDoc = await roomCollection.doc(loginInfo.roomId).get();
  if (!roomDoc || !roomDoc.exists() || !roomDoc.data.data) {
    // 部屋が存在しない場合
    throw new ApplicationError(`No such room. id=${loginInfo.roomId}`);
  }

  // ユーザコレクションの取得とユーザ情報更新
  const roomUserCollectionName = `${roomDoc.data.data.roomCollectionPrefix}-DATA-user-list`;
  const userCollection = driver.collection<StoreObj<UserStore>>(roomUserCollectionName);
  const userDocSnap: DocumentChange<StoreObj<UserStore>> =
    (await userCollection
      .where("data.roomId", "==", loginInfo.roomId)
      .where("data.userName", "==", loginInfo.userName)
      .get()).docs
        .filter(doc => doc.exists())[0];

  let addRoomMember: boolean = true;
  let userId: string;
  if (!userDocSnap || !userDocSnap.exists()) {
    // ユーザが存在しない場合

    // パスワードを暗号化
    loginInfo.userPassword = await hash(loginInfo.userPassword, hashAlgorithm);
    // リクエスト情報が定義に忠実とは限らないのでチェック
    if (loginInfo.userType !== "PL" && loginInfo.userType !== "GM" && loginInfo.userType !== "VISITOR") {
      loginInfo.userType = "VISITOR";
    }

    const userDocRef = await userCollection.add({
      order: -1,
      exclusionOwner: null,
      createTime: new Date(),
      updateTime: null,
      data: {
        userName: loginInfo.userName,
        userPassword: loginInfo.userPassword, // TODO パスワードの実データはコレクションを分ける
        userType: loginInfo.userType || "PL",
        login: 1
      }
    });
    userId = userDocRef.id;
  } else {
    // ユーザが存在した場合
    userId = userDocSnap.ref.id;
    try {
      const userData = userDocSnap.data.data;
      if (await verify(userData.userPassword, loginInfo.userPassword, hashAlgorithm)) {
        // パスワードチェックOK
        if (userData.userType !== loginInfo.userType) {
          // ユーザ種別の変更がある場合はそれを反映する

          // リクエスト情報が定義に忠実とは限らないのでチェック
          if (loginInfo.userType !== "PL" && loginInfo.userType !== "GM" && loginInfo.userType !== "VISITOR") {
            loginInfo.userType = "VISITOR";
          }
          userData.userType = loginInfo.userType;
        }
        userData.login++;
        addRoomMember = userData.login === 1;
        await userDocSnap.ref.update({
          data: userData
        });
      } else {
        // パスワードチェックで引っかかった
        return false;
      }
    } catch (err) {
      throw new SystemError(`Login verify fatal error. user-name=${loginInfo.userName}`);
    }
  }

  if (addRoomMember) {
    // ログインできたので部屋の入室人数を更新
    const roomData = roomDoc.data.data;
    roomData.memberNum++;

    await roomDoc.ref.update({
      data: roomData
    });
  }

  (await driver.collection<SocketStore>(SYSTEM_COLLECTION.SOCKET_LIST)
    .where("socketId", "==", socketId)
    .get()).docs
    .forEach(doc => {
      if (doc.exists()) {
        doc.ref.update({
          roomId: loginInfo.roomId,
          userId
        });
      }
    });

  return true;
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
