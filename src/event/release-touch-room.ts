import {Resister, SYSTEM_COLLECTION} from "../server";
import {ApplicationError} from "../error/ApplicationError";
import {deleteTouchier, getRoomInfo, setEvent} from "./common";
import Driver from "nekostore/lib/Driver";
import {ReleaseTouchRequest} from "../@types/room";

// インタフェース
const eventName = "release-touch-room";
type RequestType = ReleaseTouchRequest;
type ResponseType = void;

/**
 * 部屋（作成・編集・削除）キャンセル処理
 * @param driver
 * @param exclusionOwner
 * @param arg 部屋番号
 */
export async function releaseTouchRoom(driver: Driver, exclusionOwner: string, arg: RequestType): Promise<ResponseType> {
  const doc = await getRoomInfo(driver, arg.roomNo, {
    exclusionOwner
  });
  if (!doc) throw new ApplicationError(`Already released touch or created room. room-no=${arg.roomNo}`);
  await deleteTouchier(driver, exclusionOwner, SYSTEM_COLLECTION.ROOM_LIST, doc.ref.id);
  if (doc.data!.data) {
    await doc.ref.update({
      exclusionOwner: null
    });
  } else {
    await doc.ref.delete();
  }
}

const resist: Resister = (driver: Driver, socket: any): void => {
  setEvent<RequestType, ResponseType>(driver, socket, eventName, (driver: Driver, arg: RequestType) => releaseTouchRoom(driver, socket.id, arg));
};
export default resist;

