import {Resister} from "../server";
import Driver from "nekostore/lib/Driver";
import {UpdateDataRequest} from "../@types/socket";
import {updateSingleData} from "./update-data";
import {setEvent} from "../utility/server";
import {procAsyncSplit} from "../utility/async";
import {touchCheck} from "../utility/data";

// インタフェース
const eventName = "update-data-package";
type RequestType = UpdateDataRequest<any>;
type ResponseType = void;

/**
 * データ編集処理
 * @param driver
 * @param socket
 * @param arg
 */
export async function updateDataPackage(driver: Driver, socket: any, arg: RequestType): Promise<ResponseType> {
  // タッチチェック
  await procAsyncSplit(arg.optionList.map(option => touchCheck(
    driver,
    arg.collection,
    option.key
  )));

  // データ更新
  await procAsyncSplit(arg.optionList.map((option, idx) => updateSingleData(
    driver,
    socket,
    arg.collection,
    arg.dataList[idx],
    option
  )));
}

const resist: Resister = (driver: Driver, socket: any): void => {
  setEvent<RequestType, ResponseType>(driver, socket, eventName, (driver: Driver, arg: RequestType) => updateDataPackage(driver, socket, arg));
};
export default resist;
