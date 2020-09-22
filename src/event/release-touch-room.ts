import {Resister, SYSTEM_COLLECTION} from "../server";
import {ApplicationError} from "../error/ApplicationError";
import Driver from "nekostore/lib/Driver";
import {ReleaseTouchRoomRequest} from "../@types/socket";
import {StoreObj} from "../@types/store";
import {RoomStore} from "../@types/data";
import {getRoomInfo} from "../utility/collection";
import {setEvent} from "../utility/server";
import {deleteTouchier} from "../utility/touch";

// インタフェース
const eventName = "release-touch-room";
type RequestType = ReleaseTouchRoomRequest;
type ResponseType = void;

/**
 * 部屋（作成・編集・削除）キャンセル処理
 * @param driver
 * @param socketId
 * @param arg 部屋番号
 * @param updateForce
 */
export async function releaseTouchRoom(
  driver: Driver,
  socketId: string,
  arg: RequestType,
  updateForce?: boolean
): Promise<ResponseType> {
  const doc = await getRoomInfo(driver, arg.roomNo, { socketId });

  const createThrowDetail = (detail: string) => updateForce ? `Failure releaseTouchRoom. (${detail})` : detail;

  if (!doc) throw new ApplicationError(createThrowDetail(`Already released touch or created.`), arg);

  const backupUpdateTime = await deleteTouchier(driver, socketId, SYSTEM_COLLECTION.ROOM_LIST, doc.data!.key);

  if (updateForce || doc.data!.data) {
    const updateInfo: Partial<StoreObj<RoomStore>> = {
      exclusionOwner: null,
      status: "touched-released",
      updateTime: backupUpdateTime
    };
    try {
      await doc.ref.update(updateInfo);
    } catch (err) {
      throw new ApplicationError(createThrowDetail("Failure update doc."), updateInfo);
    }
  } else {
    try {
      await doc.ref.delete();
    } catch (err) {
      throw new ApplicationError(createThrowDetail("Failure delete doc."), arg);
    }
  }
}

const resist: Resister = (driver: Driver, socket: any): void => {
  setEvent<RequestType, ResponseType>(driver, socket, eventName, (driver: Driver, arg: RequestType) => releaseTouchRoom(driver, socket.id, arg));
};
export default resist;
