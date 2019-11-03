import {StoreObj} from "../@types/store";
import {Resister} from "../server";
import {addTouchier, setEvent} from "./common";
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
  const c = await driver.collection<StoreObj<any>>(arg.collection);
  const docRef = await c.add({
    order: -1,
    exclusionOwner,
    createTime: new Date(),
    updateTime: null
  });
  await addTouchier(driver, exclusionOwner, arg.collection, docRef.id);
  return docRef.id;
}

const resist: Resister = (driver: Driver, socket: any): void => {
  setEvent<RequestType, ResponseType>(driver, socket, eventName, (driver: Driver, arg: RequestType) => touchData(driver, socket.id, arg));
};
export default resist;
