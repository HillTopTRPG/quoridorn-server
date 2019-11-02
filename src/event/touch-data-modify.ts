import {Resister} from "../server";
import {ApplicationError} from "../error/ApplicationError";
import {addTouchier, getData, setEvent} from "./common";
import Driver from "nekostore/lib/Driver";
import {TouchRequest} from "../@types/data";

// インタフェース
const eventName = "touch-data-modify";
type RequestType = TouchRequest;
type ResponseType = void;

/**
 * データ（編集・削除）着手リクエスト
 * @param driver
 * @param exclusionOwner
 * @param arg
 */
export async function touchDataModify(driver: Driver, exclusionOwner: string, arg: RequestType): Promise<ResponseType> {
  const docSnap = await getData(driver, arg.collection, arg.id);

  if (!docSnap) throw new ApplicationError(`No such data. id=${arg.id}`);
  if (docSnap.data.exclusionOwner)
    throw new ApplicationError(`Other player touched. id=${arg.id}`);

  await docSnap.ref.update({
    exclusionOwner,
    updateTime: new Date()
  });
  await addTouchier(driver, exclusionOwner, arg.collection, docSnap.ref.id);
}

const resist: Resister = (driver: Driver, socket: any): void => {
  setEvent<RequestType, ResponseType>(driver, socket, eventName, (driver: Driver, arg: RequestType) => touchDataModify(driver, socket.id, arg));
};
export default resist;
