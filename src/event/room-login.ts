import {hashAlgorithm, Resister, SYSTEM_COLLECTION} from "../server";
import {SystemError} from "../error/SystemError";
import {verify} from "../utility/password";
import {setEvent, getRoomInfo} from "./common";
import Driver from "nekostore/lib/Driver";
import DocumentSnapshot from "nekostore/lib/DocumentSnapshot";
import {RoomLoginRequest, RoomStore, SocketStore} from "../@types/socket";
import {StoreObj} from "../@types/store";
import {ApplicationError} from "../error/ApplicationError";
import {releaseTouchRoom} from "./release-touch-room";

// インタフェース
const eventName = "room-login";
type RequestType = RoomLoginRequest;
type ResponseType = string;

/**
 * ログイン処理
 * @param driver
 * @param exclusionOwner
 * @param arg
 */
async function roomLogin(driver: Driver, exclusionOwner: string, arg: RequestType): Promise<ResponseType> {
  console.log(`START [roomLogin (${exclusionOwner})] no=${arg.roomNo}`);

  const socketDocSnap: DocumentSnapshot<SocketStore> =
    (await driver.collection<SocketStore>(SYSTEM_COLLECTION.SOCKET_LIST)
      .where("socketId", "==", exclusionOwner)
      .get())
      .docs
      .filter(doc => doc && doc.exists())[0];

  if (!socketDocSnap) {
    console.log(`ERROR [roomLogin (${exclusionOwner})] no=${arg.roomNo}`);
    throw new ApplicationError(`No such socket.`);
  }

  // タッチ解除
  try {
    await releaseTouchRoom(driver, exclusionOwner, {
      roomNo: arg.roomNo
    }, true);
  } catch (err) {
    console.log(`ERROR [roomLogin (${exclusionOwner})] no=${arg.roomNo}`);
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
    console.log(`ERROR [roomLogin (${exclusionOwner})] no=${arg.roomNo}`);
    throw err;
  }

  if (!docSnap) {
    console.log(`ERROR [roomLogin (${exclusionOwner})] no=${arg.roomNo}`);
    throw new ApplicationError(`Untouched room error. room-no=${arg.roomNo}`);
  }

  if (!docSnap.data.data) {
    console.log(`ERROR [roomLogin (${exclusionOwner})] no=${arg.roomNo}`);
    throw new ApplicationError(`Until created room error. room-no=${arg.roomNo}`);
  }

  // 部屋パスワードチェック
  let verifyResult;
  try {
    verifyResult = await verify(docSnap.data.data.roomPassword, arg.roomPassword, hashAlgorithm);
  } catch (err) {
    console.log(`ERROR [roomLogin (${exclusionOwner})] no=${arg.roomNo}`);
    throw new SystemError(`Login verify fatal error. room-no=${arg.roomNo}`);
  }

  if (!verifyResult) {
    // パスワードチェックで引っかかった
    console.log(`ERROR [roomLogin (${exclusionOwner})] no=${arg.roomNo}`);
    throw new ApplicationError(`Password mismatch. room-no=${arg.roomNo}`);
  }

  try {
    await socketDocSnap.ref.update({
      roomId: arg.roomId
    });
  } catch (err) {
    console.log(`ERROR [roomLogin (${exclusionOwner})] no=${arg.roomNo}`);
    throw err;
  }

  console.log(`END [roomLogin (${exclusionOwner})] no=${arg.roomNo}`);
  return docSnap.data.data.roomCollectionPrefix;
}

const resist: Resister = (driver: Driver, socket: any): void => {
  setEvent<RequestType, ResponseType>(driver, socket, eventName, (driver: Driver, arg: RequestType) => roomLogin(driver, socket.id, arg));
};
export default resist;
