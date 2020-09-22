import {Resister, SYSTEM_COLLECTION} from "../server";
import {ApplicationError} from "../error/ApplicationError";
import Driver from "nekostore/lib/Driver";
import {TouchRoomRequest} from "../@types/socket";
import {StoreObj} from "../@types/store";
import {RoomStore} from "../@types/data";
import {checkViewer, getRoomInfo} from "../utility/collection";
import {setEvent} from "../utility/server";
import {addTouchier} from "../utility/touch";

// インタフェース
const eventName = "touch-room-modify";
type RequestType = TouchRoomRequest;
type ResponseType = void;

/**
 * 部屋（編集・削除）着手リクエスト
 * @param driver
 * @param socketId
 * @param arg 部屋番号
 */
export async function touchRoomModify(driver: Driver, socketId: string, arg: RequestType): Promise<ResponseType> {
  const doc = await getRoomInfo(driver, arg.roomNo);

  if (!await checkViewer(driver, socketId))
    throw new ApplicationError(`Unsupported user.`, { socketId });

  // No such check.
  if (!doc || !doc.exists()) throw new ApplicationError(`No such.`, arg);

  // Already check.
  if (doc.data.exclusionOwner) throw new ApplicationError(`Already touched.`, arg);

  const updateTime = doc.data.updateTime;

  const updateInfo: Partial<StoreObj<RoomStore>> = {
    exclusionOwner: socketId,
    lastExclusionOwner: socketId,
    status: "modify-touched",
    updateTime: new Date()
  };
  try {
    await doc.ref.update(updateInfo);
  } catch (err) {
    throw new ApplicationError(`Failure update doc.`, updateInfo);
  }

  await addTouchier(driver, socketId, SYSTEM_COLLECTION.ROOM_LIST, doc.data.key, updateTime);
}

const resist: Resister = (driver: Driver, socket: any): void => {
  setEvent<RequestType, ResponseType>(driver, socket, eventName, (driver: Driver, arg: RequestType) => touchRoomModify(driver, socket.id, arg));
};
export default resist;
