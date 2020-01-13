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

  // No such check.
  if (!docSnap || !docSnap.exists()) throw new ApplicationError(`No such room.`, arg);

  // Not yet check.
  if (!docSnap.data.data) throw new ApplicationError(`Not yet created`, arg);

  const data = docSnap.data.data;

  // 部屋パスワードチェック
  let verifyResult;
  try {
    verifyResult = await verify(data.roomPassword, arg.roomPassword, hashAlgorithm);
  } catch (err) {
    throw new SystemError(`Login verify fatal error. room-no=${arg.roomNo}`);
  }

  // パスワードチェックで引っかかった
  if (!verifyResult) throw new ApplicationError(`Password mismatch.`, arg);

  const updateInfo = {
    roomId: arg.roomId
  };
  try {
    await socketDocSnap.ref.update(updateInfo);
  } catch (err) {
    throw new ApplicationError(`Failure update doc.`, updateInfo);
  }

  return data.roomCollectionPrefix;
}

const resist: Resister = (driver: Driver, socket: any): void => {
  setEvent<RequestType, ResponseType>(driver, socket, eventName, (driver: Driver, arg: RequestType) => roomLogin(driver, socket.id, arg));
};
export default resist;
