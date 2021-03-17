import {CreateRoomRequest} from "../@types/socket";
import {PERMISSION_DEFAULT, hashAlgorithm, Resister, serverSetting} from "../server";
import {hash} from "../utility/password";
import uuid from "uuid";
import Driver from "nekostore/lib/Driver";
import DocumentSnapshot from "nekostore/lib/DocumentSnapshot";
import {ApplicationError} from "../error/ApplicationError";
import {releaseTouchRoom} from "./release-touch-room";
import {RoomStore, SocketStore} from "../@types/data";
import {getRoomInfo, getSocketDocSnap, resistCollectionName} from "../utility/collection";
import {setEvent} from "../utility/server";

// インタフェース
const eventName = "create-room";
type RequestType = CreateRoomRequest;
type ResponseType = string;

/**
 * 部屋作成処理
 * @param driver
 * @param exclusionOwner
 * @param arg
 */
async function createRoom(driver: Driver, exclusionOwner: string, arg: RequestType): Promise<ResponseType> {
  const socketDocSnap = (await getSocketDocSnap(driver, exclusionOwner));

  // タッチ解除
  await releaseTouchRoom(driver, exclusionOwner, {
    roomNo: arg.roomNo
  }, true);

  // 部屋一覧の更新
  const doc: DocumentSnapshot<StoreData<RoomStore>> | null = await getRoomInfo(
    driver,
    arg.roomNo,
    { key: arg.roomKey }
  );

  // Untouched check.
  if (!doc || !doc.exists()) throw new ApplicationError(`Untouched room.`, arg);

  // Already check.
  if (doc.data.data) throw new ApplicationError(`Already created room.`, arg);

  const roomCreatePassword = serverSetting.roomCreatePassword || "";
  if (
    !roomCreatePassword && arg.roomCreatePassword !== undefined ||
    roomCreatePassword && roomCreatePassword !== arg.roomCreatePassword
  ) {
    try {
      await doc.ref.delete();
    } catch (e) {
      // Nothing.
    }
    throw new ApplicationError(`The password to create the room seems to be wrong.`, arg);
  }

  // リクエスト情報の加工
  try {
    arg.roomPassword = await hash(arg.roomPassword, hashAlgorithm);
  } catch (err) {
    try {
      await doc.ref.delete();
    } catch (e) {
      // Nothing.
    }
    throw new ApplicationError(`Failure hash.`, { hashAlgorithm });
  }
  delete arg.roomNo;

  const roomCollectionPrefix = uuid.v4();
  const storageId = uuid.v4();

  // 部屋情報の更新
  const storeData: RoomStore = {
    ...arg,
    memberNum: 0,
    hasPassword: !!arg.roomPassword,
    roomCollectionPrefix,
    storageId
  };

  const updateRoomInfo: Partial<StoreData<RoomStore>> = {
    data: storeData,
    status: "added",
    updateTime: new Date()
  };
  try {
    await doc.ref.update(updateRoomInfo);
  } catch (err) {
    try {
      await doc.ref.delete();
    } catch (e) {
      // Nothing.
    }
    throw new ApplicationError(`Failure update roomInfo doc.`, updateRoomInfo);
  }

  // Socket情報の更新
  const updateSocketInfo: Partial<SocketStore> = {
    roomKey: arg.roomKey,
    roomNo: arg.roomNo,
    roomCollectionPrefix,
    storageId
  };
  try {
    await socketDocSnap.ref.update(updateSocketInfo);
  } catch (err) {
    try {
      await doc.ref.delete();
    } catch (e) {
      // Nothing.
    }
    throw new ApplicationError(`Failure update socketInfo doc.`, updateSocketInfo);
  }

  // 部屋に付随する情報の生成
  const authorityGroupCCName = `${roomCollectionPrefix}-DATA-authority-group-list`;
  const authorityGroupCC = driver.collection<StoreData<AuthorityGroupStore>>(authorityGroupCCName);

  const addGroup = async (name: string, order: number) => {
    await authorityGroupCC.add({
      collection: "authority-group-list",
      key: uuid.v4(),
      ownerType: null,
      owner: null,
      order,
      exclusionOwner: null,
      lastExclusionOwner: null,
      permission: PERMISSION_DEFAULT,
      status: "added",
      createTime: new Date(),
      updateTime: null,
      refList: [],
      data: {
        name,
        isSystem: true,
        list: []
      }
    });
  };

  try {
    await addGroup("All", 0);
    await addGroup("Users", 1);
    await addGroup("GameMasters", 2);
    await addGroup("Players", 3);
    await addGroup("Visitors", 4);
  } catch (err) {
    try {
      await doc.ref.delete();
    } catch (e) {
      // Nothing.
    }
    throw err;
  }

  await resistCollectionName(driver, authorityGroupCCName);

  // 接尾句を返却
  return roomCollectionPrefix;
}

const resist: Resister = (driver: Driver, socket: any): void => {
  setEvent<RequestType, ResponseType>(driver, socket, eventName, (driver: Driver, arg: RequestType) => createRoom(driver, socket.id, arg));
};
export default resist;
