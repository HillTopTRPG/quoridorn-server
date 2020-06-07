import {Resister} from "../server";
import {ApplicationError} from "../error/ApplicationError";
import {getData, procAsyncSplit, setEvent} from "./common";
import Driver from "nekostore/lib/Driver";
import {UpdateDataRequest} from "../@types/socket";
import {singleUpdateData} from "./update-data";

// インタフェース
const eventName = "update-data-package";
type RequestType = UpdateDataRequest;
type ResponseType = void;

/**
 * データ編集処理
 * @param driver
 * @param arg
 */
export async function updateDataPackage(driver: Driver, arg: RequestType): Promise<ResponseType> {
  // タッチチェック
  await procAsyncSplit(arg.idList.map((id: string) => touchCheck(
    driver,
    arg.collection,
    id
  )));

  // データ更新
  await procAsyncSplit(arg.idList.map((id: string, idx: number) => singleUpdateData(
    driver,
    arg.collection,
    id,
    arg.dataList[idx],
    arg.optionList ? arg.optionList[idx] : undefined
  )));
}

async function touchCheck(
  driver: Driver,
  collection: string,
  id: string
): Promise<void> {
  const msgArg = { collection, id };
  const docSnap = await getData(driver, collection, id);

  // No such check.
  if (!docSnap || !docSnap.exists()) throw new ApplicationError(`No such.`, msgArg);

  // Already check.
  if (docSnap.data.exclusionOwner) throw new ApplicationError(`Already touched.`, msgArg);
}

const resist: Resister = (driver: Driver, socket: any): void => {
  setEvent<RequestType, ResponseType>(driver, socket, eventName, (driver: Driver, arg: RequestType) => updateDataPackage(driver, arg));
};
export default resist;