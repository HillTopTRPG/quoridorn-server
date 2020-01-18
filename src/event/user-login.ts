import {hashAlgorithm, Resister, SYSTEM_COLLECTION} from "../server";
import {SystemError} from "../error/SystemError";
import {verify} from "../utility/password";
import {addUser, getSocketDocSnap, setEvent} from "./common";
import Driver from "nekostore/lib/Driver";
import DocumentSnapshot from "nekostore/lib/DocumentSnapshot";
import {UserLoginRequest, UserLoginResponse, UserType} from "../@types/socket";
import {StoreObj} from "../@types/store";
import {ApplicationError} from "../error/ApplicationError";
import DocumentChange from "nekostore/lib/DocumentChange";
import {ActorGroup, RoomStore, SocketStore, UserStore} from "../@types/data";

// インタフェース
const eventName = "user-login";
type RequestType = UserLoginRequest;
type ResponseType = UserLoginResponse;

/**
 * ログイン処理
 * @param driver
 * @param exclusionOwner
 * @param arg
 */
async function userLogin(driver: Driver, exclusionOwner: string, arg: RequestType): Promise<ResponseType> {
  // 部屋一覧の更新
  const socketDocSnap = (await getSocketDocSnap(driver, exclusionOwner));

  // Not yet check.
  const roomId = socketDocSnap.data!.roomId;
  if (!roomId) throw new ApplicationError(`Not yet login.`, arg);

  const roomDocSnap: DocumentSnapshot<StoreObj<RoomStore>> =
    await driver.collection<StoreObj<RoomStore>>(SYSTEM_COLLECTION.ROOM_LIST).doc(roomId).get();

  if (!roomDocSnap || !roomDocSnap.exists() || !roomDocSnap.data.data)
    throw new ApplicationError(`No such room.`, { roomId });

  // ユーザコレクションの取得とユーザ情報更新
  const roomCollectionPrefix = roomDocSnap.data.data.roomCollectionPrefix;
  const roomUserCollectionName = `${roomCollectionPrefix}-DATA-user-list`;
  const userCollection = driver.collection<StoreObj<UserStore>>(roomUserCollectionName);
  const userDocSnap: DocumentChange<StoreObj<UserStore>> =
    (await userCollection
      .where("data.userName", "==", arg.userName)
      .get()).docs
      .filter(doc => doc.exists())[0];

  let addRoomMember: boolean = true;

  // リクエスト情報が定義に忠実とは限らないのでチェック
  if (arg.userType !== "PL" && arg.userType !== "GM" && arg.userType !== "VISITOR")
    arg.userType = "VISITOR";

  let userLoginResponse: UserLoginResponse;

  if (!userDocSnap || !userDocSnap.exists()) {
    // ユーザが存在しない場合
    userLoginResponse = await addUser(
      driver,
      exclusionOwner,
      roomCollectionPrefix,
      arg.userName,
      arg.userPassword,
      arg.userType
    );
  } else {
    // ユーザが存在した場合
    const userData = userDocSnap.data.data!;
    const userId = userDocSnap.ref.id;

    userLoginResponse = {
      userId,
      token: userData.token
    };
    let verifyResult;
    try {
      verifyResult = await verify(userData.userPassword, arg.userPassword, hashAlgorithm);
    } catch (err) {
      throw new SystemError(`Login verify fatal error. user-name=${arg.userName}`);
    }

    // パスワードチェックで引っかかった
    if (!verifyResult) throw new ApplicationError(`Password mismatch.`, arg);

    // ユーザ種別の変更がある場合はそれを反映する
    if (userData.userType !== arg.userType) {
      const getGroupName = (userType: UserType) => {
        if (userType === "PL") return "Players";
        return userType === "GM" ? "GameMasters" : "Visitors";
      };
      const oldGroupName = getGroupName(userData.userType);
      const newGroupName = getGroupName(arg.userType);
      userData.userType = arg.userType;

      const actorGroupCollectionName = `${roomCollectionPrefix}-DATA-actor-group-list`;
      const actorGroupCollection = driver.collection<StoreObj<ActorGroup>>(actorGroupCollectionName);

      // 元のグループから削除
      const oldGroupDoc = (await actorGroupCollection.where("data.name", "==", oldGroupName).get()).docs[0];
      const oldGroupData: ActorGroup = oldGroupDoc.data!.data!;
      const index = oldGroupData.list.findIndex(g => g.id === userId);
      oldGroupData.list.splice(index, 1);
      await oldGroupDoc.ref.update({
        data: oldGroupData
      });

      // 新しいグループに追加
      const newGroupDoc = (await actorGroupCollection.where("data.name", "==", newGroupName).get()).docs[0];
      const newGroupData: ActorGroup = newGroupDoc.data!.data!;
      newGroupData.list.push({
        type: "user",
        id: userId
      });
      await newGroupDoc.ref.update({
        data: newGroupData
      });
    }

    // 人数更新
    userData.login++;
    addRoomMember = userData.login === 1;

    const updateUserInfo: Partial<StoreObj<UserStore>> = {
      data: userData
    };
    try {
      await userDocSnap.ref.update(updateUserInfo);
    } catch (err) {
      throw new ApplicationError(`Failure update login doc.`, updateUserInfo);
    }

    const updateSocketInfo: Partial<SocketStore> = {
      userId: userDocSnap.ref.id
    };
    try {
      await socketDocSnap.ref.update(updateSocketInfo);
    } catch (err) {
      throw new ApplicationError(`Failure update socket doc.`, updateSocketInfo);
    }
  }

  const roomData = roomDocSnap.data.data;
  if (addRoomMember) {
    // ログインできたので部屋の入室人数を更新
    roomData.memberNum++;

    const updateRoomInfo: Partial<StoreObj<RoomStore>> = {
      data: roomData
    };
    try {
      await roomDocSnap.ref.update(updateRoomInfo);
    } catch (err) {
      throw new ApplicationError(`Failure update room doc.`, updateRoomInfo);
    }
  }

  return userLoginResponse;
}

const resist: Resister = (driver: Driver, socket: any): void => {
  setEvent<RequestType, ResponseType>(driver, socket, eventName, (driver: Driver, arg: RequestType) => userLogin(driver, socket.id, arg));
};
export default resist;
