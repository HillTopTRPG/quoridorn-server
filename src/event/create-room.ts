import {StoreObj} from "../@types/store";
import {CreateRoomRequest} from "../@types/socket";
import {hashAlgorithm, Resister} from "../server";
import {hash} from "../utility/password";
import uuid from "uuid";
import {getRoomInfo, getSocketDocSnap, setEvent} from "./common";
import Driver from "nekostore/lib/Driver";
import DocumentSnapshot from "nekostore/lib/DocumentSnapshot";
import {ApplicationError} from "../error/ApplicationError";
import {releaseTouchRoom} from "./release-touch-room";
import {ActorGroup, RoomStore, SocketStore} from "../@types/data";

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
  const docSnap: DocumentSnapshot<StoreObj<RoomStore>> | null = await getRoomInfo(
    driver,
    arg.roomNo,
    { id: arg.roomId }
  );

  // Untouched check.
  if (!docSnap || !docSnap.exists()) throw new ApplicationError(`Untouched room.`, arg);

  // Already check.
  if (docSnap.data.data) throw new ApplicationError(`Already created room.`, arg);

  // リクエスト情報の加工
  try {
    arg.roomPassword = await hash(arg.roomPassword, hashAlgorithm);
  } catch (err) {
    throw new ApplicationError(`Failure hash.`, { hashAlgorithm });
  }
  delete arg.roomNo;

  // 部屋情報の更新
  const storeData: RoomStore = {
    ...arg,
    memberNum: 0,
    hasPassword: !!arg.roomPassword,
    roomCollectionPrefix: uuid.v4()
  };

  const updateRoomInfo: Partial<StoreObj<RoomStore>> = {
    data: storeData,
    status: "added",
    updateTime: new Date()
  };
  try {
    await docSnap.ref.update(updateRoomInfo);
  } catch (err) {
    throw new ApplicationError(`Failure update roomInfo doc.`, updateRoomInfo);
  }

  // Socket情報の更新
  const updateSocketInfo: Partial<SocketStore> = { roomId: arg.roomId };
  try {
    await socketDocSnap.ref.update(updateSocketInfo);
  } catch (err) {
    throw new ApplicationError(`Failure update socketInfo doc.`, updateSocketInfo);
  }

  const roomCollectionPrefix = storeData.roomCollectionPrefix;

  // 部屋に付随する情報の生成
  const actorGroupCCName = `${roomCollectionPrefix}-DATA-actor-group-list`;
  const actorGroupCC = driver.collection<StoreObj<ActorGroup>>(actorGroupCCName);

  const addGroup = async (name: string, order: number, isChatGroup: boolean) => {
    await actorGroupCC.add({
      order,
      exclusionOwner: null,
      owner: null,
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
      },
      status: "added",
      createTime: new Date(),
      updateTime: null,
      data: {
        name,
        isSystem: true,
        isChatGroup,
        list: []
      }
    });
  };
  await addGroup("All", 0, true);
  await addGroup("Users", 1, false);
  await addGroup("GameMasters", 2, false);
  await addGroup("Players", 3, false);
  await addGroup("Visitors", 4, false);

  // 接尾句を返却
  return roomCollectionPrefix;
}

const resist: Resister = (driver: Driver, socket: any): void => {
  setEvent<RequestType, ResponseType>(driver, socket, eventName, (driver: Driver, arg: RequestType) => createRoom(driver, socket.id, arg));
};
export default resist;
