import {Resister} from "../server";
import {ApplicationError} from "../error/ApplicationError";
import {getRoomInfo, setEvent} from "./common";
import Driver from "nekostore/lib/Driver";
import {ReleaseTouchRequest} from "../@types/room";

// インタフェース
const eventName = "release-touch-room";
type RequestType = ReleaseTouchRequest;
type ResponseType = void;

/**
 * 部屋（作成・編集）キャンセル処理
 * @param driver
 * @param exclusionOwner
 * @param arg 部屋番号
 */
async function releaseTouchRoom(driver: Driver, exclusionOwner: string, arg: RequestType): Promise<ResponseType> {
  const doc = await getRoomInfo(driver, arg.roomNo);
  if (!doc) throw new ApplicationError(`Already released touch or created room. room-no=${arg.roomNo}`);
  if (doc.data!.data) {
    doc.ref.update({
      exclusionOwner: null
    });
  } else {
    doc.ref.delete();
  }
}

const resist: Resister = (driver: Driver, socket: any): void => {
  setEvent<RequestType, ResponseType>(driver, socket, eventName, (driver: Driver, arg: RequestType) => releaseTouchRoom(driver, socket.id, arg));
};
export default resist;

