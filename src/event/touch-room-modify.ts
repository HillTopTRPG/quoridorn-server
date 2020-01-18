import {Resister, SYSTEM_COLLECTION} from "../server";
import {ApplicationError} from "../error/ApplicationError";
import {addTouchier, checkViewer, getRoomInfo, setEvent} from "./common";
import Driver from "nekostore/lib/Driver";
import {TouchRoomRequest} from "../@types/socket";
import {StoreObj} from "../@types/store";
import {RoomStore} from "../@types/data";

// インタフェース
const eventName = "touch-room-modify";
type RequestType = TouchRoomRequest;
type ResponseType = void;

/**
 * 部屋（編集・削除）着手リクエスト
 * @param driver
 * @param exclusionOwner
 * @param arg 部屋番号
 */
export async function touchRoomModify(driver: Driver, exclusionOwner: string, arg: RequestType): Promise<ResponseType> {
  const docSnap = await getRoomInfo(driver, arg.roomNo);

  if (!await checkViewer(driver, exclusionOwner))
    throw new ApplicationError(`Unsupported user.`, { socketId: exclusionOwner });

  // No such check.
  if (!docSnap || !docSnap.exists()) throw new ApplicationError(`No such.`, arg);

  // Already check.
  if (docSnap.data.exclusionOwner) throw new ApplicationError(`Already touched.`, arg);

  const updateInfo: Partial<StoreObj<RoomStore>> = {
    exclusionOwner,
    status: "modify-touched",
    updateTime: new Date()
  };
  try {
    await docSnap.ref.update(updateInfo);
  } catch (err) {
    throw new ApplicationError(`Failure update doc.`, updateInfo);
  }

  await addTouchier(driver, exclusionOwner, SYSTEM_COLLECTION.ROOM_LIST, docSnap.ref.id);
}

const resist: Resister = (driver: Driver, socket: any): void => {
  setEvent<RequestType, ResponseType>(driver, socket, eventName, (driver: Driver, arg: RequestType) => touchRoomModify(driver, socket.id, arg));
};
export default resist;
