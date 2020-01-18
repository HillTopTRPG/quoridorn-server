import {Resister} from "../server";
import {ApplicationError} from "../error/ApplicationError";
import {getData, setEvent} from "./common";
import Driver from "nekostore/lib/Driver";
import {UpdateDataRequest} from "../@types/socket";
import {releaseTouchData} from "./release-touch-data";
import {StoreObj} from "../@types/store";

// インタフェース
const eventName = "update-data";
type RequestType = UpdateDataRequest;
type ResponseType = void;

/**
 * データ編集処理
 * @param driver
 * @param exclusionOwner
 * @param arg
 */
export async function updateData(driver: Driver, exclusionOwner: string, arg: RequestType): Promise<ResponseType> {
  // タッチ解除
  await releaseTouchData(driver, exclusionOwner, arg, true);

  const docSnap = await getData(driver, arg.collection, arg.id);

  // No such check.
  if (!docSnap || !docSnap.exists() || !docSnap.data.data) throw new ApplicationError(`No such data.`, arg);

  const updateInfo: Partial<StoreObj<any>> = {
    data: arg.data,
    status: "modified",
    updateTime: new Date()
  };
  if (arg.permission) updateInfo.permission = arg.permission;
  try {
    await docSnap.ref.update(updateInfo);
  } catch (err) {
    throw new ApplicationError(`Failure update doc.`, updateInfo);
  }
}

const resist: Resister = (driver: Driver, socket: any): void => {
  setEvent<RequestType, ResponseType>(driver, socket, eventName, (driver: Driver, arg: RequestType) => updateData(driver, socket.id, arg));
};
export default resist;
