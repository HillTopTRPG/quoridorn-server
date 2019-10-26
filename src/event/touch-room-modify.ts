import {Resister} from "../server";
import {ApplicationError} from "../error/ApplicationError";
import {getRoomInfo, setEvent} from "./common";
import Driver from "nekostore/lib/Driver";
import {TouchRequest} from "../@types/room";
import {checkViewer} from "./get-room-list";

// インタフェース
const eventName = "touch-room-modify";
type RequestType = TouchRequest;
type ResponseType = void;

/**
 * 部屋（編集・削除）着手リクエスト
 * @param driver
 * @param exclusionOwner
 * @param arg 部屋番号
 */
async function touchRoomModify(driver: Driver, exclusionOwner: string, arg: RequestType): Promise<ResponseType> {
  const doc = await getRoomInfo(driver, arg.roomNo);

  if (!await checkViewer(driver, exclusionOwner, false))
    throw new ApplicationError(`Unsupported user.`);

  if (!doc) throw new ApplicationError(`No such room. room-no=${arg.roomNo}`);
  if (doc.data.exclusionOwner)
    throw new ApplicationError(`Other player touched. room-no=${arg.roomNo}`);

  doc.ref.update({
    exclusionOwner
  });
}

const resist: Resister = (driver: Driver, socket: any): void => {
  setEvent<RequestType, ResponseType>(driver, socket, eventName, (driver: Driver, arg: RequestType) => touchRoomModify(driver, socket.id, arg));
};
export default resist;
