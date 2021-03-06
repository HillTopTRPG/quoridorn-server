import {Resister} from "../server";
import Driver from "nekostore/lib/Driver";
import {UpdateDataRequest} from "../@types/socket";
import {releaseTouchData} from "./release-touch-data";
import {setEvent} from "../utility/server";
import {updateResourceMasterRelation} from "../utility/data-resource-master";
import {procAsyncSplit} from "../utility/async";
import {updateSimple} from "../utility/data";
import {splitCollectionName} from "../utility/collection";
import {updateRoomDataRelation} from "../utility/data-room";

// インタフェース
const eventName = "update-data";
type RequestType = UpdateDataRequest<any>;
type ResponseType = void;

type ProcessMap = {
  [collectionSuffixName: string]: (
    driver: Driver,
    socket: any,
    collection: string,
    option: (Partial<StoreData<any>> & { key: string; continuous?: boolean; })
  ) => Promise<void>
}

export function getAddRelationCollectionMap(): ProcessMap {
  return {
    "resource-master-list": updateResourceMasterRelation,
    "room-data": updateRoomDataRelation,
  };
}

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
  data: (Partial<StoreData<T>> & { key: string; continuous?: boolean; })
): Promise<void> {
  const {roomCollectionSuffix} = splitCollectionName(collectionName);
  const relationCollectionTable = await getAddRelationCollectionMap();
  // console.log(!!relationCollectionTable[roomCollectionSuffix]);
  // console.log(relationCollectionTable[roomCollectionSuffix]);
  const callUpdateFunc = relationCollectionTable[roomCollectionSuffix] || updateSimple;
  await callUpdateFunc(driver, socket, collectionName, data);
}

const resist: Resister = (driver: Driver, socket: any): void => {
  setEvent<RequestType, ResponseType>(driver, socket, eventName, (driver: Driver, arg: RequestType) => updateData(driver, socket, arg));
};
export default resist;
