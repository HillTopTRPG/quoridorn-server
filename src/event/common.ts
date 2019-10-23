import Driver from "nekostore/lib/Driver";
import DocumentSnapshot from "nekostore/lib/DocumentSnapshot";
import {StoreMetaData, StoreObj} from "../@types/store";
import {hashAlgorithm, SYSTEM_COLLECTION} from "../server";
import {SystemError} from "../error/SystemError";
import {RoomStore, RoomViewerStore, UserLoginRequest, UseStore} from "../@types/room";
import {ApplicationError} from "../error/ApplicationError";
import CollectionReference from "nekostore/src/CollectionReference";
import DocumentChange from "nekostore/lib/DocumentChange";
import {hash, verify} from "../password";

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
      createTime: doc.createTime ? doc.createTime.toDate() : null,
      updateTime: doc.updateTime ? doc.updateTime.toDate() : null
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
    if (roomDocList[0].ref.id !== option.id) throw new ApplicationError(`Already recreated room. room-no=${roomNo}`);
  }

  return roomDocList[0];
}

export async function removeRoomViewer(
  driver: Driver,
  socketId: string
) {
  const c = driver.collection<RoomViewerStore>(SYSTEM_COLLECTION.ROOM_VIEWER_LIST);
  const doc: DocumentChange<RoomViewerStore> = (await c
    .where("socketId", "==", socketId)
    .get()).docs
    .filter(doc => doc.exists())[0];
  if (doc) doc.ref.delete();
}

export async function userLogin(
  driver: Driver,
  loginInfo: UserLoginRequest
): Promise<boolean> {
  const c = driver.collection<UseStore>(SYSTEM_COLLECTION.USER_LIST);
  const doc: DocumentChange<UseStore> = (await c
    .where("roomId", "==", loginInfo.roomId)
    .where("userName", "==", loginInfo.userName)
    .get()).docs
      .filter(doc => doc.exists())[0];
  if (!doc) {
    // ユーザが存在しない場合
    loginInfo.userPassword = await hash(loginInfo.userPassword, hashAlgorithm);
    await c.add({
      ...loginInfo,
      userType: loginInfo.userType || "PL"
    });
    return true;
  } else {
    // ユーザが存在した場合
    try {
      if (await verify(doc.data.userPassword, loginInfo.userPassword, hashAlgorithm)) {
        // パスワードチェックOK
        if (doc.data.userType !== loginInfo.userType) {
          // ユーザタイプの変更があれば反映する
          await doc.ref.update({
            userType: loginInfo.userType
          });
        }
        return true;
      } else {
        // パスワードチェックで引っかかった
        return false;
      }
    } catch (err) {
      throw new SystemError(`Login verify fatal error. user-name=${loginInfo.userName}`);
    }
  }
}
