import {StoreObj} from "../@types/store";
import {Resister, SYSTEM_COLLECTION} from "../server";
import {ApplicationError} from "../error/ApplicationError";
import {addTouchier, getRoomInfo, setEvent} from "./common";
import Driver from "nekostore/lib/Driver";
import {RoomStore, TouchRequest} from "../@types/room";
import {checkViewer} from "./get-room-list";

// インタフェース
const eventName = "touch-room";
type RequestType = TouchRequest;
type ResponseType = void;

/**
 * 部屋（作成）着手リクエスト
 * @param driver
 * @param exclusionOwner
 * @param arg 部屋番号
 */
async function touchRoom(driver: Driver, exclusionOwner: string, arg: RequestType): Promise<ResponseType> {
  const c = await driver.collection<StoreObj<RoomStore>>(SYSTEM_COLLECTION.ROOM_LIST);
  const doc = await getRoomInfo(driver, arg.roomNo, { collectionReference: c });

  if (!await checkViewer(driver, exclusionOwner, false))
    throw new ApplicationError(`Unsupported user.`);

  if (doc) throw new ApplicationError(`Already touched or created room. room-no=${arg.roomNo}`);
  const docRef = await c.add({
    order: arg.roomNo,
    exclusionOwner
  });
  addTouchier(driver, exclusionOwner, SYSTEM_COLLECTION.ROOM_LIST, docRef.id);
}

const resist: Resister = (driver: Driver, socket: any): void => {
  setEvent<RequestType, ResponseType>(driver, socket, eventName, (driver: Driver, arg: RequestType) => touchRoom(driver, socket.id, arg));
};
export default resist;
