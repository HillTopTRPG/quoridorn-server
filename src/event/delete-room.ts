import {StoreObj} from "../@types/store";
import {DeleteRoomRequest} from "../@types/socket";
import {hashAlgorithm, Resister, accessUrl, bucket, s3Client} from "../server";
import {verify} from "../utility/password";
import Driver from "nekostore/lib/Driver";
import DocumentSnapshot from "nekostore/lib/DocumentSnapshot";
import {ApplicationError} from "../error/ApplicationError";
import {SystemError} from "../error/SystemError";
import {releaseTouchRoom} from "./release-touch-room";
import { Db } from "mongodb";
import {RoomStore} from "../@types/data";
import {getRoomInfo} from "../utility/collection";
import {setEvent} from "../utility/server";
import {doDeleteRoom} from "../utility/data-room";

// インタフェース
const eventName = "delete-room";
type RequestType = DeleteRoomRequest;
type ResponseType = boolean;

/**
 * 部屋削除処理
 * @param driver
 * @param socket
 * @param arg
 * @param db
 */
async function deleteRoom(driver: Driver, socket: any, arg: RequestType, db?: Db): Promise<ResponseType> {
  const exclusionOwner: string = socket.id;

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
  const data = docSnap.data.data;
  if (!data) throw new ApplicationError(`Already deleted.`, arg);

  // 部屋パスワードチェック
  try {
    if (!await verify(data.roomPassword, arg.roomPassword, hashAlgorithm)) {
      // パスワードチェックで引っかかった
      return false;
    }
  } catch (err) {
    throw new SystemError(`Login verify fatal error. room-no=${arg.roomNo}`);
  }

  await doDeleteRoom(driver, db, docSnap);

  return true;
}

const resist: Resister = (driver: Driver, socket: any, _io: any, db?: Db): void => {
  setEvent<RequestType, ResponseType>(driver, socket, eventName, (driver: Driver, arg: RequestType) => deleteRoom(driver, socket, arg, db));
};
export default resist;
