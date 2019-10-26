import {StoreObj} from "../@types/store";
import {DeleteRoomRequest, RoomStore} from "../@types/room";
import {hashAlgorithm, Resister} from "../server";
import {verify} from "../password";
import {getRoomInfo, setEvent} from "./common";
import Driver from "nekostore/lib/Driver";
import DocumentSnapshot from "nekostore/lib/DocumentSnapshot";
import {ApplicationError} from "../error/ApplicationError";
import {SystemError} from "../error/SystemError";

// インタフェース
const eventName = "delete-room";
type RequestType = DeleteRoomRequest;
type ResponseType = boolean;

/**
 * 部屋削除処理
 * @param driver
 * @param exclusionOwner
 * @param arg
 */
async function deleteRoom(driver: Driver, exclusionOwner: string, arg: RequestType): Promise<ResponseType> {
  // 部屋一覧の更新
  const roomInfoSnapshot: DocumentSnapshot<StoreObj<RoomStore>> = await getRoomInfo(
    driver,
    arg.roomNo,
    { exclusionOwner, id: arg.roomId }
  );
  if (!roomInfoSnapshot) throw new ApplicationError(`Untouched room error. room-no=${arg.roomNo}`);

  const data = roomInfoSnapshot.data;
  if (!data.data)
    throw new ApplicationError(`Already deleted room error. room-no=${arg.roomNo}`);

  // 部屋パスワードチェック
  try {
    if (!await verify(roomInfoSnapshot.data.data.roomPassword, arg.roomPassword, hashAlgorithm)) {
      // パスワードチェックで引っかかった
      return false;
    }
  } catch (err) {
    throw new SystemError(`Login verify fatal error. room-no=${arg.roomNo}`);
  }

  roomInfoSnapshot.ref.delete();

  return true;
}

const resist: Resister = (driver: Driver, socket: any): void => {
  setEvent<RequestType, ResponseType>(driver, socket, eventName, (driver: Driver, arg: RequestType) => deleteRoom(driver, socket.id, arg));
};
export default resist;
