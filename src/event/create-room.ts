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
  console.log(`START [createRoom (${exclusionOwner})] no=${arg.roomNo}, name=${arg.name}`);
  const socketDocSnap: DocumentSnapshot<SocketStore> =
    (await driver.collection<SocketStore>(SYSTEM_COLLECTION.SOCKET_LIST)
      .where("socketId", "==", exclusionOwner)
      .get())
      .docs
      .filter(doc => doc && doc.exists())[0];
  if (!socketDocSnap) {
    console.log(`ERROR [createRoom (${exclusionOwner})] no=${arg.roomNo}, name=${arg.name}`);
    throw new ApplicationError(`No such socket.`);
  }

  // タッチ解除
  try {
    await releaseTouchRoom(driver, exclusionOwner, {
      roomNo: arg.roomNo
    }, true);
  } catch (err) {
    console.log(`ERROR [createRoom (${exclusionOwner})] no=${arg.roomNo}, name=${arg.name}`);
    throw err;
  }

  // 部屋一覧の更新
  let docSnap: DocumentSnapshot<StoreObj<RoomStore>>;

  try {
    docSnap = await getRoomInfo(
      driver,
      arg.roomNo,
      { id: arg.roomId }
    );
  } catch (err) {
    console.log(`ERROR [createRoom (${exclusionOwner})] no=${arg.roomNo}, name=${arg.name}`);
    throw err;
  }

  if (!docSnap || !docSnap.exists()) {
    console.log(`ERROR [createRoom (${exclusionOwner})] no=${arg.roomNo}, name=${arg.name}`);
    throw new ApplicationError(`Untouched room error. room-no=${arg.roomNo}`);
  }

  if (docSnap.data.data) {
    console.log(`ERROR [createRoom (${exclusionOwner})] no=${arg.roomNo}, name=${arg.name}`);
    throw new ApplicationError(`Already created room error. room-no=${arg.roomNo}`);
  }

  // リクエスト情報の加工
  try {
    arg.roomPassword = await hash(arg.roomPassword, hashAlgorithm);
  } catch (err) {
    console.log(`ERROR [createRoom (${exclusionOwner})] no=${arg.roomNo}, name=${arg.name}`);
    throw err;
  }
  delete arg.roomNo;

  const storeData: RoomStore = {
    ...arg,
    memberNum: 0,
    hasPassword: !!arg.roomPassword,
    roomCollectionPrefix: uuid.v4()
  };

  try {
    await docSnap.ref.update({
      data: storeData,
      status: "added",
      updateTime: new Date()
    });
  } catch (err) {
    console.log(`ERROR [createRoom (${exclusionOwner})] no=${arg.roomNo}, name=${arg.name}`);
    throw err;
  }

  try {
    await socketDocSnap.ref.update({
      roomId: arg.roomId
    });
  } catch (err) {
    console.log(`ERROR [createRoom (${exclusionOwner})] no=${arg.roomNo}, name=${arg.name}`);
    throw err;
  }

  console.log(`END [createRoom (${exclusionOwner})] no=${arg.roomNo}, name=${arg.name}`);
  return storeData.roomCollectionPrefix;
}

const resist: Resister = (driver: Driver, socket: any): void => {
  setEvent<RequestType, ResponseType>(driver, socket, eventName, (driver: Driver, arg: RequestType) => createRoom(driver, socket.id, arg));
};
export default resist;
