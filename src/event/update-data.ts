import {Resister} from "../server";
import {ApplicationError} from "../error/ApplicationError";
import {getData, procAsyncSplit, setEvent} from "./common";
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

  await procAsyncSplit(arg.idList.map((id: string, idx: number) => singleUpdateData(
    driver,
    arg.collection,
    id,
    arg.dataList[idx],
    arg.optionList ? arg.optionList[idx] : undefined
  )));
}

export async function singleUpdateData(
  driver: Driver,
  collection: string,
  id: string,
  data: any,
  option?: Partial<StoreObj<unknown>> & { continuous?: boolean }
): Promise<void> {
  const msgArg = { collection, id, option };
  const docSnap = await getData(driver, collection, id);

  // No such check.
  if (!docSnap || !docSnap.exists() || !docSnap.data.data) throw new ApplicationError(`No such data.`, msgArg);

  const updateInfo: Partial<StoreObj<any>> = {
    data,
    status: "modified",
    updateTime: new Date()
  };
  if (option) {
    if (option.permission) updateInfo.permission = option.permission;
    if (option.order !== undefined) updateInfo.order = option.order || 0;
    if (option.owner) updateInfo.owner = option.owner;
    if (option.ownerType) updateInfo.ownerType = option.ownerType;
  }
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
