import {Resister} from "../server";
import Driver from "nekostore/lib/Driver";
import {DeleteDataRequest} from "../@types/socket";
import {setEvent} from "../utility/server";
import {notifyProgress} from "../utility/emit";
import {deleteSingleData} from "./delete-data";
import {procAsyncSplit} from "../utility/async";
import {touchCheck} from "../utility/data";

// インタフェース
const eventName = "delete-data-package";
type RequestType = DeleteDataRequest;
type ResponseType = void;

/**
 * データ削除処理
 * @param driver
 * @param socket
 * @param arg
 * @param sendNotify
 * @param nestNum
 * @param nestNumTotal
 */
export async function deleteDataPackage(
  driver: Driver,
  socket: any,
  arg: RequestType,
  sendNotify: boolean = true,
  nestNum: number = 0,
  nestNumTotal: number = 0
): Promise<ResponseType> {
  // タッチチェック
  await procAsyncSplit(arg.idList.map((id: string) => touchCheck(
    driver,
    arg.collection,
    id
  )));

  const total = nestNumTotal || arg.idList.length;

  // 直列の非同期で全部実行する
  await arg.idList
    .map((id: string, idx: number) => () => deleteSingleData(driver, socket, arg.collection, id, sendNotify, nestNum + idx, total))
    .reduce((prev, curr) => prev.then(curr), Promise.resolve());

  // 進捗報告(完了)
  if (sendNotify) notifyProgress(socket, total, nestNum + arg.idList.length);
}

const resist: Resister = (driver: Driver, socket: any): void => {
  setEvent<RequestType, ResponseType>(driver, socket, eventName, (driver: Driver, arg: RequestType) => deleteDataPackage(driver, socket, arg));
};
export default resist;
