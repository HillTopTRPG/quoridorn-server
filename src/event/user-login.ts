import {hashAlgorithm, Resister, SYSTEM_COLLECTION} from "../server";
import {SystemError} from "../error/SystemError";
import {verify} from "../utility/password";
import {addUser, setEvent} from "./common";
import Driver from "nekostore/lib/Driver";
import DocumentSnapshot from "nekostore/lib/DocumentSnapshot";
import {RoomStore, SocketStore, UserLoginRequest, UserStore} from "../@types/socket";
import {StoreObj} from "../@types/store";
import {ApplicationError} from "../error/ApplicationError";
import DocumentChange from "nekostore/lib/DocumentChange";

// インタフェース
const eventName = "user-login";
type RequestType = UserLoginRequest;
type ResponseType = void;

/**
 * ログイン処理
 * @param driver
 * @param exclusionOwner
 * @param arg
 */
async function userLogin(driver: Driver, exclusionOwner: string, arg: RequestType): Promise<ResponseType> {
  // 部屋一覧の更新
  const socketDocSnap: DocumentSnapshot<SocketStore> =
    (await driver.collection<SocketStore>(SYSTEM_COLLECTION.SOCKET_LIST)
      .where("socketId", "==", exclusionOwner)
      .get())
      .docs
      .filter(doc => doc && doc.exists())[0];
  if (!socketDocSnap) throw new ApplicationError(`No such socket.`);

  const roomId = socketDocSnap.data.roomId;
  if (!roomId) throw new ApplicationError(`Until login to room socket.`);

  const roomDocSnap: DocumentSnapshot<StoreObj<RoomStore>> =
    await driver.collection<StoreObj<RoomStore>>(SYSTEM_COLLECTION.ROOM_LIST).doc(roomId).get();

  if (!roomDocSnap || !roomDocSnap.exists() || !roomDocSnap.data.data)
    throw new ApplicationError(`No such room. room-id=${roomId}`);

  // ユーザコレクションの取得とユーザ情報更新
  const roomUserCollectionName = `${roomDocSnap.data.data.roomCollectionPrefix}-DATA-user-list`;
  const userCollection = driver.collection<StoreObj<UserStore>>(roomUserCollectionName);
  const userDocSnap: DocumentChange<StoreObj<UserStore>> =
    (await userCollection
    .where("data.userName", "==", arg.userName)
    .get()).docs
    .filter(doc => doc.exists())[0];

  let addRoomMember: boolean = true;

  // リクエスト情報が定義に忠実とは限らないのでチェック
  if (arg.userType !== "PL" && arg.userType !== "GM" && arg.userType !== "VISITOR") {
    arg.userType = "VISITOR";
  }

  if (!userDocSnap || !userDocSnap.exists()) {
    // ユーザが存在しない場合
    await addUser(userCollection, socketDocSnap, arg.userName, arg.userPassword, arg.userType);
  } else {
    // ユーザが存在した場合
    const userData = userDocSnap.data.data;
    let verifyResult;
    try {
      verifyResult = await verify(userData.userPassword, arg.userPassword, hashAlgorithm);
    } catch (err) {
      throw new SystemError(`Login verify fatal error. user-name=${arg.userName}`);
    }
    if (!verifyResult) {
      // パスワードチェックで引っかかった
      throw new ApplicationError(`Password mismatch. user-name=${arg.userName}`);
    }

    // パスワードチェックOK
    if (userData.userType !== arg.userType) {
      // ユーザ種別の変更がある場合はそれを反映する
      userData.userType = arg.userType;
    }
    userData.login++;
    addRoomMember = userData.login === 1;
    await userDocSnap.ref.update({
      data: userData
    });

    socketDocSnap.ref.update({
      userId: userDocSnap.ref.id
    });
  }

  const roomData = roomDocSnap.data.data;
  if (addRoomMember) {
    // ログインできたので部屋の入室人数を更新
    roomData.memberNum++;

    await roomDocSnap.ref.update({
      data: roomData
    });
  }
}

const resist: Resister = (driver: Driver, socket: any): void => {
  setEvent<RequestType, ResponseType>(driver, socket, eventName, (driver: Driver, arg: RequestType) => userLogin(driver, socket.id, arg));
};
export default resist;
