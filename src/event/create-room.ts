import {StoreObj} from "../@types/store";
import {CreateRoomRequest, RoomStore, SocketStore} from "../@types/socket";
import {hashAlgorithm, Resister, SYSTEM_COLLECTION} from "../server";
import {hash} from "../utility/password";
import uuid from "uuid";
import {getRoomInfo, setEvent} from "./common";
import Driver from "nekostore/lib/Driver";
import DocumentSnapshot from "nekostore/lib/DocumentSnapshot";
import {ApplicationError} from "../error/ApplicationError";
import {releaseTouchRoom} from "./release-touch-room";

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
  const socketDocSnap: DocumentSnapshot<SocketStore> =
    (await driver.collection<SocketStore>(SYSTEM_COLLECTION.SOCKET_LIST)
      .where("socketId", "==", exclusionOwner)
      .get())
      .docs
      .filter(doc => doc && doc.exists())[0];

  // No such socket check.
  if (!socketDocSnap) throw new ApplicationError(`No such socket.`, { socketId: exclusionOwner });

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

  const updateSocketInfo: Partial<SocketStore> = { roomId: arg.roomId };
  try {
    await socketDocSnap.ref.update(updateSocketInfo);
  } catch (err) {
    throw new ApplicationError(`Failure update socketInfo doc.`, updateSocketInfo);
  }

  return storeData.roomCollectionPrefix;
}

const resist: Resister = (driver: Driver, socket: any): void => {
  setEvent<RequestType, ResponseType>(driver, socket, eventName, (driver: Driver, arg: RequestType) => createRoom(driver, socket.id, arg));
};
export default resist;
