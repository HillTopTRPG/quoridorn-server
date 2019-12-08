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
  console.log(`START [touchRoomModify (${exclusionOwner})] no=${arg.roomNo}`);
  let docSnap;
  try {
    docSnap = await getRoomInfo(driver, arg.roomNo);
  } catch (err) {
    console.log(`ERROR [touchRoomModify (${exclusionOwner})] no=${arg.roomNo}`);
    throw err;
  }

  if (!await checkViewer(driver, exclusionOwner, false)) {
    console.log(`ERROR [touchRoomModify (${exclusionOwner})] no=${arg.roomNo}`);
    throw new ApplicationError(`Unsupported user.`);
  }

  if (!docSnap) {
    console.log(`ERROR [touchRoomModify (${exclusionOwner})] no=${arg.roomNo}`);
    throw new ApplicationError(`No such room. room-no=${arg.roomNo}`);
  }

  if (docSnap.data.exclusionOwner) {
    console.log(`ERROR [touchRoomModify (${exclusionOwner})] no=${arg.roomNo}`);
    throw new ApplicationError(`Other player touched. room-no=${arg.roomNo}`);
  }

  try {
    await docSnap.ref.update({
      exclusionOwner,
      status: "modify-touched",
      updateTime: new Date()
    });
  } catch (err) {
    console.log(`ERROR [touchRoomModify (${exclusionOwner})] no=${arg.roomNo}`);
    throw err;
  }

  try {
    await addTouchier(driver, exclusionOwner, SYSTEM_COLLECTION.ROOM_LIST, docSnap.ref.id);
  } catch (err) {
    console.log(`ERROR [touchRoomModify (${exclusionOwner})] no=${arg.roomNo}`);
    throw err;
  }

  console.log(`END [touchRoomModify (${exclusionOwner})] no=${arg.roomNo}`);
}

const resist: Resister = (driver: Driver, socket: any): void => {
  setEvent<RequestType, ResponseType>(driver, socket, eventName, (driver: Driver, arg: RequestType) => touchRoomModify(driver, socket.id, arg));
};
export default resist;
