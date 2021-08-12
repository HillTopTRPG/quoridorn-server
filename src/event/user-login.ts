import {PERMISSION_DEFAULT, hashAlgorithm, Resister, SYSTEM_COLLECTION} from "../server";
import {SystemError} from "../error/SystemError";
import {verify} from "../utility/password";
import Driver from "nekostore/lib/Driver";
import {UserLoginRequest, UserLoginResponse, UserType} from "../@types/socket";
import {ApplicationError} from "../error/ApplicationError";
import {RoomStore, SocketStore} from "../@types/data";
import {findSingle, getSocketDocSnap, resistCollectionName} from "../utility/collection";
import {setEvent} from "../utility/server";
import {addUser} from "../utility/data-user";
import uuid = require("uuid");

// インタフェース
const eventName = "user-login";
type RequestType = UserLoginRequest;
type ResponseType = UserLoginResponse;

/**
 * ログイン処理
 * @param driver
 * @param socket
 * @param arg
 */
async function userLogin(driver: Driver, socket: any, arg: RequestType): Promise<ResponseType> {
  const socketId: string = socket.id;

  // 部屋一覧の更新
  const socketDocSnap = (await getSocketDocSnap(driver, socketId));

  // Not yet check.
  const roomKey = socketDocSnap.data!.roomKey;
  if (!roomKey) throw new ApplicationError(`Not yet login.`, arg);
  
  const roomDoc = await findSingle<StoreData<RoomStore>>(
    driver, 
    SYSTEM_COLLECTION.ROOM_LIST, 
    "key", 
    roomKey
  );

  if (!roomDoc || !roomDoc.exists() || !roomDoc.data.data)
    throw new ApplicationError(`No such room.`, { roomKey });

  // ユーザコレクションの取得とユーザ情報更新
  const roomCollectionPrefix = roomDoc.data.data.roomCollectionPrefix!;
  const userDoc = await findSingle<StoreData<UserStore>>(
    driver,
    `${roomCollectionPrefix}-DATA-user-list`,
    "data.name",
    arg.name
  );

  let addRoomMember: boolean = true;

  // リクエスト情報が定義に忠実とは限らないのでチェック
  if (arg.type !== "PL" && arg.type !== "GM" && arg.type !== "VISITOR")
    arg.type = "VISITOR";

  let userLoginResponse: UserLoginResponse;

  if (!userDoc || !userDoc.exists()) {
    // ユーザが存在しない場合
    userLoginResponse = await addUser(
      driver,
      socket,
      roomCollectionPrefix,
      arg.name,
      arg.password,
      arg.type
    );
  } else {
    // ユーザが存在した場合
    const userData = userDoc.data.data!;
    const userKey = userDoc.data.key;

    userLoginResponse = {
      userKey,
      token: userData.token
    };
    let verifyResult;
    try {
      verifyResult = await verify(userData.password, arg.password, hashAlgorithm);
    } catch (err) {
      throw new SystemError(`Login verify fatal error. user-name=${arg.name}`);
    }

    // パスワードチェックで引っかかった
    if (!verifyResult) throw new ApplicationError(`Password mismatch.`, arg);

    // ユーザ種別の変更がある場合はそれを反映する
    if (userData.type !== arg.type) {
      const getGroupName = (type: UserType) => {
        if (type === "PL") return "Players";
        return type === "GM" ? "GameMasters" : "Visitors";
      };

      const authorityGroupCollectionName = `${roomCollectionPrefix}-DATA-authority-group-list`;

      const oldGroupDoc = await findSingle<StoreData<AuthorityGroupStore>>(
        driver,
        authorityGroupCollectionName,
        "data.name",
        getGroupName(userData.type)
      );
      const newGroupDoc = await findSingle<StoreData<AuthorityGroupStore>>(
        driver,
        authorityGroupCollectionName,
        "data.name",
        getGroupName(arg.type)
      );
      if (oldGroupDoc && newGroupDoc) {
        // 元のグループから削除
        const oldGroupData: AuthorityGroupStore = oldGroupDoc.data!.data!;
        const idx = oldGroupData.list.findIndex(g => g.userKey === userKey);
        const elm = oldGroupData.list.splice(idx, 1)[0];
        await oldGroupDoc.ref.update({
          data: oldGroupData
        });

        // 新しいグループに追加
        const newGroupData: AuthorityGroupStore = newGroupDoc.data!.data!;
        newGroupData.list.push(elm);
        await newGroupDoc.ref.update({
          data: newGroupData
        });
      }
      userData.type = arg.type;
    }

    // 人数更新
    userData.login++;
    addRoomMember = userData.login === 1;

    const updateUserInfo: Partial<StoreData<UserStore>> = {
      data: userData,
      updateTime: new Date()
    };
    try {
      await userDoc.ref.update(updateUserInfo);
    } catch (err) {
      throw new ApplicationError(`Failure update login doc.`, updateUserInfo);
    }

    const updateSocketInfo: Partial<SocketStore> = {
      userKey: userDoc.data.key
    };
    try {
      await socketDocSnap.ref.update(updateSocketInfo);
    } catch (err) {
      throw new ApplicationError(`Failure update socket doc.`, updateSocketInfo);
    }
  }

  const roomData = roomDoc.data.data;
  if (addRoomMember) {
    // ログインできたので部屋の入室人数を更新
    roomData.memberNum++;

    const updateRoomInfo: Partial<StoreData<RoomStore>> = {
      data: roomData
    };
    try {
      await roomDoc.ref.update(updateRoomInfo);
    } catch (err) {
      throw new ApplicationError(`Failure update room doc.`, updateRoomInfo);
    }
  }

  const userKey = userLoginResponse.userKey;
  // 部屋データとして追加
  const roomSocketUserCollectionName = `${roomCollectionPrefix}-DATA-socket-user-list`;
  const socketUserCollection = driver.collection<StoreData<SocketUserStore>>(roomSocketUserCollectionName);
  await socketUserCollection.add({
    collection: "socket-user-list",
    key: uuid.v4(),
    order: 0,
    ownerType: null,
    owner: null,
    exclusionOwner: null,
    lastExclusionOwner: null,
    permission: PERMISSION_DEFAULT,
    status: "modified",
    createTime: new Date(),
    updateTime: null,
    refList: [],
    data: {
      socketId,
      userKey
    }
  });

  await resistCollectionName(driver, roomSocketUserCollectionName);

  return userLoginResponse;
}

const resist: Resister = (driver: Driver, socket: any): void => {
  setEvent<RequestType, ResponseType>(driver, socket, eventName, (driver: Driver, arg: RequestType) => userLogin(driver, socket, arg));
};
export default resist;
