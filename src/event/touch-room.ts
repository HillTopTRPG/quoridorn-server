import {StoreObj} from "../@types/store";
import {PERMISSION_DEFAULT, Resister, SYSTEM_COLLECTION} from "../server";
import {ApplicationError} from "../error/ApplicationError";
import Driver from "nekostore/lib/Driver";
import {TouchRoomRequest} from "../@types/socket";
import {RoomStore} from "../@types/data";
import {checkViewer, getRoomInfo} from "../utility/collection";
import {setEvent} from "../utility/server";
import {addTouchier} from "../utility/touch";

// インタフェース
const eventName = "touch-room";
type RequestType = TouchRoomRequest;
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
    ownerType: null,
    owner: null,
    order: arg.roomNo,
    exclusionOwner,
    lastExclusionOwner: exclusionOwner,
    status: "initial-touched",
    createTime: new Date(),
    updateTime: null,
    permission: PERMISSION_DEFAULT
  };
  try {
    docRef = await c.add(addInfo);
  } catch (err) {
    throw new ApplicationError(`Failure add doc.`, addInfo);
  }

  await addTouchier(driver, exclusionOwner, SYSTEM_COLLECTION.ROOM_LIST, docRef.id, null);
}

const resist: Resister = (driver: Driver, socket: any): void => {
  setEvent<RequestType, ResponseType>(driver, socket, eventName, (driver: Driver, arg: RequestType) => touchRoom(driver, socket.id, arg));
};
export default resist;
