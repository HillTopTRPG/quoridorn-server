import {Resister} from "../server";
import {ApplicationError} from "../error/ApplicationError";
import {getData, setEvent} from "./common";
import Driver from "nekostore/lib/Driver";
import {UpdateDataRequest} from "../@types/data";
import {releaseTouchData} from "./release-touch-data";

// インタフェース
const eventName = "update-data";
type RequestType = UpdateDataRequest;
type ResponseType = void;

/**
 * データ（編集・削除）着手リクエスト
 * @param driver
 * @param exclusionOwner
 * @param arg
 */
export async function updateData(driver: Driver, exclusionOwner: string, arg: RequestType): Promise<ResponseType> {
  // タッチ解除
  await releaseTouchData(driver, exclusionOwner, arg, true);

  const docSnap = await getData(driver, arg.collection, arg.id);

  if (!docSnap || !docSnap.exists() || !docSnap.data.data)
    throw new ApplicationError(`No such data. id=${arg.id}`);

  await docSnap.ref.update({
    data: arg.data,
    updateTime: new Date()
  });
}

const resist: Resister = (driver: Driver, socket: any): void => {
  setEvent<RequestType, ResponseType>(driver, socket, eventName, (driver: Driver, arg: RequestType) => updateData(driver, socket.id, arg));
};
export default resist;
