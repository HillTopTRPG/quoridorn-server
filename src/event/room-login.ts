import {hashAlgorithm, Resister} from "../server";
import {SystemError} from "../error/SystemError";
import {verify} from "../utility/password";
import {setEvent, getRoomInfo, getSocketDocSnap} from "./common";
import Driver from "nekostore/lib/Driver";
import DocumentSnapshot from "nekostore/lib/DocumentSnapshot";
import {RoomLoginRequest} from "../@types/socket";
import {StoreObj} from "../@types/store";
import {ApplicationError} from "../error/ApplicationError";
import {releaseTouchRoom} from "./release-touch-room";
import {RoomStore, SocketStore} from "../@types/data";

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
  const socketDocSnap = (await getSocketDocSnap(driver, exclusionOwner))!;

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

  const updateInfo: Partial<SocketStore> = {
    roomId: arg.roomId,
    roomCollectionPrefix: data.roomCollectionPrefix,
    storageId: data.storageId
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
