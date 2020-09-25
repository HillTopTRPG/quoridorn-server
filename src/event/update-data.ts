import {Resister} from "../server";
import Driver from "nekostore/lib/Driver";
import {UpdateDataRequest} from "../@types/socket";
import {releaseTouchData} from "./release-touch-data";
import {StoreObj} from "../@types/store";
import {setEvent} from "../utility/server";
import {updateResourceMasterRelation} from "../utility/data-resource-master";
import {procAsyncSplit} from "../utility/async";
import {updateSimple} from "../utility/data";
import {splitCollectionName} from "../utility/collection";

// インタフェース
const eventName = "update-data";
type RequestType = UpdateDataRequest<any>;
type ResponseType = void;

const relationCollectionTable: {
  [collectionSuffixName: string]: (
    driver: Driver,
    socket: any,
    collection: string,
    option: (Partial<StoreObj<any>> & { key: string; continuous?: boolean; })
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

  await procAsyncSplit(arg.list.map(data => updateSingleData(
    driver,
    socket,
    arg.collection,
    data
  )));
}

export async function updateSingleData<T>(
  driver: Driver,
  socket: any,
  collectionName: string,
  data: (Partial<StoreObj<T>> & { key: string; continuous?: boolean; })
): Promise<void> {
  const {roomCollectionSuffix} = splitCollectionName(collectionName);
  const callUpdateFunc = relationCollectionTable[roomCollectionSuffix] || updateSimple;
  await callUpdateFunc(driver, socket, collectionName, data);
}

const resist: Resister = (driver: Driver, socket: any): void => {
  setEvent<RequestType, ResponseType>(driver, socket, eventName, (driver: Driver, arg: RequestType) => updateData(driver, socket, arg));
};
export default resist;
