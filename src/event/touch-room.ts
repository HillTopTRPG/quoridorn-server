import {PERMISSION_DEFAULT, Resister, SYSTEM_COLLECTION} from "../server";
import {ApplicationError} from "../error/ApplicationError";
import Driver from "nekostore/lib/Driver";
import {TouchRoomRequest} from "../@types/socket";
import {RoomStore} from "../@types/data";
import {checkViewer, getRoomInfo} from "../utility/collection";
import {setEvent} from "../utility/server";
import {addTouchier} from "../utility/touch";
import uuid = require("uuid");

// インタフェース
const eventName = "touch-room";
type RequestType = TouchRoomRequest;
type ResponseType = void;

/**
 * 部屋（作成）着手リクエスト
 * @param driver
 * @param socketId
 * @param arg 部屋番号
 */
async function touchRoom(driver: Driver, socketId: string, arg: RequestType): Promise<ResponseType> {
  const c = driver.collection<StoreData<RoomStore>>(SYSTEM_COLLECTION.ROOM_LIST);

  const doc = await getRoomInfo(driver, arg.roomNo, { collectionReference: c });

  if (!await checkViewer(driver, socketId))
    throw new ApplicationError(`Unsupported user.`, { socketId });

  if (doc) throw new ApplicationError(`Already touched or created room.`, arg);

  const key = uuid.v4();
  const addInfo: StoreData<RoomStore> = {
    collection: "rooms",
    key,
    ownerType: null,
    owner: null,
    order: arg.roomNo!,
    exclusionOwner: socketId,
    lastExclusionOwner: socketId,
    status: "initial-touched",
    createTime: new Date(),
    updateTime: null,
    refList: [],
    permission: PERMISSION_DEFAULT
  };
  try {
    await c.add(addInfo);
  } catch (err) {
    throw new ApplicationError(`Failure add doc.`, addInfo);
  }

  await addTouchier(driver, socketId, SYSTEM_COLLECTION.ROOM_LIST, key, null);
}

const resist: Resister = (driver: Driver, socket: any): void => {
  setEvent<RequestType, ResponseType>(driver, socket, eventName, (driver: Driver, arg: RequestType) => touchRoom(driver, socket.id, arg));
};
export default resist;
