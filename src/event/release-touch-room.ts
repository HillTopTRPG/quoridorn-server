import {Resister, SYSTEM_COLLECTION} from "../server";
import {ApplicationError} from "../error/ApplicationError";
import {deleteTouchier, getRoomInfo, setEvent} from "./common";
import Driver from "nekostore/lib/Driver";
import {ReleaseTouchRequest} from "../@types/socket";

// インタフェース
const eventName = "release-touch-room";
type RequestType = ReleaseTouchRequest;
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
  if (!docSnap) throw new ApplicationError(`Already released touch or created room. room-no=${arg.roomNo}`);
  await deleteTouchier(driver, exclusionOwner, SYSTEM_COLLECTION.ROOM_LIST, docSnap.ref.id);
  if (updateForce || docSnap.data!.data) {
    await docSnap.ref.update({
      exclusionOwner: null,
      updateTime: new Date()
    });
  } else {
    await docSnap.ref.delete();
  }
}

const resist: Resister = (driver: Driver, socket: any): void => {
  setEvent<RequestType, ResponseType>(driver, socket, eventName, (driver: Driver, arg: RequestType) => releaseTouchRoom(driver, socket.id, arg));
};
export default resist;
