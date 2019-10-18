import {StoreObj} from "../@types/store";
import {RoomInfo} from "../@types/room";
import {Resister, SYSTEM_COLLECTION} from "../server";
import {ApplicationError} from "../error/ApplicationError";
import {setEvent} from "./common";
import Driver from "nekostore/lib/Driver";

// インタフェース
const eventName = "touch-room";
type RequestType = { order: number };
type ResponseType = void;

/**
 * 部屋作成着手処理
 * @param driver
 * @param exclusionOwner
 * @param arg 部屋番号
 */
async function touchRoom(driver: Driver, exclusionOwner: string, arg: RequestType): Promise<ResponseType> {
  // console.log(`touchRoom room-no=${no}, exclusionOwner=${exclusionOwner}`);
  const c = await driver.collection<StoreObj<RoomInfo>>(SYSTEM_COLLECTION.ROOM_LIST);
  const docList = (await c.where("order", "==", arg.order).get()).docs;
  if (!docList.length) {
    // console.log("add");
    c.add({
      order: arg.order,
      exclusionOwner
    });
    return;
  }

  throw new ApplicationError(`Already touched or created room. room-no=${arg.order + 1}`);
}

const resist: Resister = (driver: Driver, socket: any): void => {
  setEvent<RequestType, ResponseType>(driver, socket, eventName, (driver: Driver, arg: RequestType) => touchRoom(driver, socket.id, arg));
};
export default resist;
