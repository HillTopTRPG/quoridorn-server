import {Resister} from "../server";
import Driver from "nekostore/lib/Driver";
import {UpdateDataRequest} from "../@types/socket";
import {releaseTouchData} from "./release-touch-data";
import {StoreObj} from "../@types/store";
import {setEvent} from "../utility/server";
import {updateResourceMasterRelation} from "../utility/data-resource-master";
import {procAsyncSplit} from "../utility/async";
import {updateSimple} from "../utility/data";

// インタフェース
const eventName = "update-data";
type RequestType = UpdateDataRequest;
type ResponseType = void;

const relationCollectionTable: {
  [collectionSuffixName: string]: (
    driver: Driver,
    socket: any,
    collection: string,
    id: string,
    data: any,
    option?: Partial<StoreObj<unknown>> & { continuous?: boolean }
  ) => Promise<void>
} = {
  "resource-master-list": updateResourceMasterRelation,
};

/**
 * データ編集処理
 * @param driver
 * @param socket
 * @param arg
 */
export async function updateData(
  driver: Driver,
  socket: any,
  arg: RequestType
): Promise<ResponseType> {
  // タッチ解除
  await releaseTouchData(driver, socket.id, arg, true);

  await procAsyncSplit(arg.idList.map((id: string, idx: number) => updateSingleData(
    driver,
    socket,
    arg.collection,
    id,
    arg.dataList[idx],
    arg.optionList ? arg.optionList[idx] : undefined
  )));
}

export async function updateSingleData(
  driver: Driver,
  socket: any,
  collectionName: string,
  id: string,
  data: any,
  option?: Partial<StoreObj<unknown>> & { continuous?: boolean }
): Promise<void> {
  const collectionSuffixName = collectionName.replace(/^.+-DATA-/, "");
  const callUpdateFunc = relationCollectionTable[collectionSuffixName] || updateSimple;
  await callUpdateFunc(driver, socket, collectionName, id, data, option);
}

const resist: Resister = (driver: Driver, socket: any): void => {
  setEvent<RequestType, ResponseType>(driver, socket, eventName, (driver: Driver, arg: RequestType) => updateData(driver, socket, arg));
};
export default resist;
