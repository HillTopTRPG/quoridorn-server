import {hashAlgorithm, Resister, SYSTEM_COLLECTION} from "../server";
import {SystemError} from "../error/SystemError";
import {verify} from "../utility/password";
import {setEvent, getRoomInfo} from "./common";
import Driver from "nekostore/lib/Driver";
import DocumentSnapshot from "nekostore/lib/DocumentSnapshot";
import {RoomLoginInfo, RoomStore, SocketStore} from "../@types/socket";
import {StoreObj} from "../@types/store";
import {ApplicationError} from "../error/ApplicationError";
import {releaseTouchRoom} from "./release-touch-room";

// インタフェース
const eventName = "room-login";
type RequestType = RoomLoginInfo;
type ResponseType = string;

/**
 * ログイン処理
 * @param driver
 * @param exclusionOwner
 * @param arg
 */
async function roomLogin(driver: Driver, exclusionOwner: string, arg: RequestType): Promise<ResponseType> {
  const socketDocSnap: DocumentSnapshot<SocketStore> =
    (await driver.collection<SocketStore>(SYSTEM_COLLECTION.SOCKET_LIST)
      .where("socketId", "==", exclusionOwner)
      .get())
      .docs
      .filter(doc => doc && doc.exists())[0];
  if (!socketDocSnap) throw new ApplicationError(`No such socket.`);

  // タッチ解除
  await releaseTouchRoom(driver, exclusionOwner, {
    roomNo: arg.roomNo
  }, true);

  // 部屋一覧の更新
  const docSnap: DocumentSnapshot<StoreObj<RoomStore>> = await getRoomInfo(
    driver,
    arg.roomNo,
    { id: arg.roomId }
  );

  if (!docSnap)
    throw new ApplicationError(`Untouched room error. room-no=${arg.roomNo}`);

  if (!docSnap.data.data)
    throw new ApplicationError(`Until created room error. room-no=${arg.roomNo}`);

  // 部屋パスワードチェック
  let verifyResult;
  try {
    verifyResult = await verify(docSnap.data.data.roomPassword, arg.roomPassword, hashAlgorithm);
  } catch (err) {
    throw new SystemError(`Login verify fatal error. room-no=${arg.roomNo}`);
  }

  if (!verifyResult) {
    // パスワードチェックで引っかかった
    throw new ApplicationError(`Password mismatch. room-no=${arg.roomNo}`);
  }

  // パスワードチェックOK
  delete docSnap.data.data.roomPassword;

  socketDocSnap.ref.update({
    roomId: arg.roomId
  });

  return docSnap.data.data.roomCollectionPrefix;
}

const resist: Resister = (driver: Driver, socket: any): void => {
  setEvent<RequestType, ResponseType>(driver, socket, eventName, (driver: Driver, arg: RequestType) => roomLogin(driver, socket.id, arg));
};
export default resist;
