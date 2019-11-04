import {Resister, SYSTEM_COLLECTION} from "../server";
import {ApplicationError} from "../error/ApplicationError";
import {addTouchier, checkViewer, getRoomInfo, setEvent} from "./common";
import Driver from "nekostore/lib/Driver";
import {TouchRequest} from "../@types/socket";

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
export async function touchRoomModify(driver: Driver, exclusionOwner: string, arg: RequestType): Promise<ResponseType> {
  const docSnap = await getRoomInfo(driver, arg.roomNo);

  if (!await checkViewer(driver, exclusionOwner, false))
    throw new ApplicationError(`Unsupported user.`);

  if (!docSnap) throw new ApplicationError(`No such room. room-no=${arg.roomNo}`);
  if (docSnap.data.exclusionOwner)
    throw new ApplicationError(`Other player touched. room-no=${arg.roomNo}`);

  await docSnap.ref.update({
    exclusionOwner,
    updateTime: new Date()
  });
  await addTouchier(driver, exclusionOwner, SYSTEM_COLLECTION.ROOM_LIST, docSnap.ref.id);
}

const resist: Resister = (driver: Driver, socket: any): void => {
  setEvent<RequestType, ResponseType>(driver, socket, eventName, (driver: Driver, arg: RequestType) => touchRoomModify(driver, socket.id, arg));
};
export default resist;
