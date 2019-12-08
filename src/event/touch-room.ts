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
  console.log(`START [touchRoom (${exclusionOwner})] no=${arg.roomNo}`);
  const c = await driver.collection<StoreObj<RoomStore>>(SYSTEM_COLLECTION.ROOM_LIST);

  let docSnap;
  try {
    docSnap = await getRoomInfo(driver, arg.roomNo, { collectionReference: c });
  } catch (err) {
    console.log(`ERROR [touchRoom (${exclusionOwner})] no=${arg.roomNo}`);
    throw err;
  }

  if (!await checkViewer(driver, exclusionOwner, false)) {
    console.log(`ERROR [touchRoom (${exclusionOwner})] no=${arg.roomNo}`);
    throw new ApplicationError(`Unsupported user.`);
  }

  if (docSnap) {
    console.log(`ERROR [touchRoom (${exclusionOwner})] no=${arg.roomNo}`);
    throw new ApplicationError(`Already touched or created room. room-no=${arg.roomNo}`);
  }

  let docRef;
  try {
    docRef = await c.add({
      order: arg.roomNo,
      exclusionOwner,
      status: "initial-touched",
      createTime: new Date(),
      updateTime: null
    });
  } catch (err) {
    console.log(`ERROR [touchRoom (${exclusionOwner})] no=${arg.roomNo}`);
    throw err;
  }

  try {
    await addTouchier(driver, exclusionOwner, SYSTEM_COLLECTION.ROOM_LIST, docRef.id);
  } catch (err) {
    console.log(`ERROR [touchRoom (${exclusionOwner})] no=${arg.roomNo}`);
    throw err;
  }

  console.log(`END [touchRoom (${exclusionOwner})] no=${arg.roomNo}`);
}

const resist: Resister = (driver: Driver, socket: any): void => {
  setEvent<RequestType, ResponseType>(driver, socket, eventName, (driver: Driver, arg: RequestType) => touchRoom(driver, socket.id, arg));
};
export default resist;
