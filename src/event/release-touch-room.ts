import {Resister, SYSTEM_COLLECTION} from "../server";
import {ApplicationError} from "../error/ApplicationError";
import {deleteTouchier, getRoomInfo, setEvent} from "./common";
import Driver from "nekostore/lib/Driver";
import {ReleaseTouchRoomRequest} from "../@types/socket";
import {StoreObj} from "../@types/store";
import {RoomStore} from "../@types/data";

// インタフェース
const eventName = "release-touch-room";
type RequestType = ReleaseTouchRoomRequest;
type ResponseType = void;

/**
 * 部屋（作成・編集・削除）キャンセル処理
 * @param driver
 * @param exclusionOwner
 * @param arg 部屋番号
 * @param updateForce
 */
export async function releaseTouchRoom(driver: Driver, exclusionOwner: string, arg: RequestType, updateForce?: boolean): Promise<ResponseType> {
  const docSnap = await getRoomInfo(driver, arg.roomNo, {
    exclusionOwner,
  });

  const createThrowDetail = (detail: string) => updateForce ? `Failure releaseTouchRoom. (${detail})` : detail;

  if (!docSnap) throw new ApplicationError(createThrowDetail(`Already released touch or created.`), arg);

  const backupUpdateTime = await deleteTouchier(driver, exclusionOwner, SYSTEM_COLLECTION.ROOM_LIST, docSnap.ref.id);

  if (updateForce || docSnap.data!.data) {
    const updateInfo: Partial<StoreObj<RoomStore>> = {
      exclusionOwner: null,
      status: "touched-released",
      updateTime: backupUpdateTime
    };
    try {
      await docSnap.ref.update(updateInfo);
    } catch (err) {
      throw new ApplicationError(createThrowDetail("Failure update doc."), updateInfo);
    }
  } else {
    try {
      await docSnap.ref.delete();
    } catch (err) {
      throw new ApplicationError(createThrowDetail("Failure delete doc."), arg);
    }
  }
}

const resist: Resister = (driver: Driver, socket: any): void => {
  setEvent<RequestType, ResponseType>(driver, socket, eventName, (driver: Driver, arg: RequestType) => releaseTouchRoom(driver, socket.id, arg));
};
export default resist;
