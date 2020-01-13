import {StoreObj} from "../@types/store";
import {Resister, SYSTEM_COLLECTION} from "../server";
import {ApplicationError} from "../error/ApplicationError";
import {addTouchier, checkViewer, getRoomInfo, setEvent} from "./common";
import Driver from "nekostore/lib/Driver";
import {RoomStore, TouchRequest} from "../@types/socket";

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

  const docSnap = await getRoomInfo(driver, arg.roomNo, { collectionReference: c });

  if (!await checkViewer(driver, exclusionOwner))
    throw new ApplicationError(`Unsupported user.`, { socketId: exclusionOwner });

  if (docSnap) throw new ApplicationError(`Already touched or created room.`, arg);

  let docRef;
  const addInfo: StoreObj<RoomStore> = {
    order: arg.roomNo,
    exclusionOwner,
    status: "initial-touched",
    createTime: new Date(),
    updateTime: null
  };
  try {
    docRef = await c.add(addInfo);
  } catch (err) {
    throw new ApplicationError(`Failure add doc.`, addInfo);
  }

  await addTouchier(driver, exclusionOwner, SYSTEM_COLLECTION.ROOM_LIST, docRef.id);
}

const resist: Resister = (driver: Driver, socket: any): void => {
  setEvent<RequestType, ResponseType>(driver, socket, eventName, (driver: Driver, arg: RequestType) => touchRoom(driver, socket.id, arg));
};
export default resist;
