import {StoreObj} from "../@types/store";
import {Resister, SYSTEM_COLLECTION} from "../server";
import {ApplicationError} from "../error/ApplicationError";
import {addTouchier, getData, setEvent} from "./common";
import Driver from "nekostore/lib/Driver";
import {TouchRequest} from "../@types/data";

// インタフェース
const eventName = "touch-data";
type RequestType = TouchRequest;
type ResponseType = string;

/**
 * データ（作成）着手リクエスト
 * @param driver
 * @param exclusionOwner
 * @param arg 部屋番号
 */
async function touchData(driver: Driver, exclusionOwner: string, arg: RequestType): Promise<ResponseType> {
  const c = await driver.collection<StoreObj<any>>(SYSTEM_COLLECTION.ROOM_LIST);
  const docSnap = await getData(driver, arg.collection, arg.id, { collectionReference: c });

  if (docSnap) throw new ApplicationError(`Already touched or created data. id=${arg.id}`);
  const docRef = await c.add({
    order: -1,
    exclusionOwner,
    createTime: new Date(),
    updateTime: null
  });
  addTouchier(driver, exclusionOwner, arg.collection, docRef.id);
  return docRef.id;
}

const resist: Resister = (driver: Driver, socket: any): void => {
  setEvent<RequestType, ResponseType>(driver, socket, eventName, (driver: Driver, arg: RequestType) => touchData(driver, socket.id, arg));
};
export default resist;
