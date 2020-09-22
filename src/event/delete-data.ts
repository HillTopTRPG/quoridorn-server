import {Resister} from "../server";
import Driver from "nekostore/lib/Driver";
import {DeleteDataRequest} from "../@types/socket";
import {releaseTouchData} from "./release-touch-data";
import {deleteSimple} from "../utility/data";
import {setEvent} from "../utility/server";
import {deleteResourceMasterRelation} from "../utility/data-resource-master";
import {notifyProgress} from "../utility/emit";
import {deleteSceneObjectRelation} from "../utility/data-scene-object";
import {deleteSceneLayerRelation} from "../utility/data-scene-layer";
import {deleteSceneRelation} from "../utility/data-scene";
import {deleteActorRelation} from "../utility/data-actor";
import {splitCollectionName} from "../utility/collection";

// インタフェース
const eventName = "delete-data";
type RequestType = DeleteDataRequest<any>;
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
async function deleteData(
  driver: Driver,
  socket: any,
  arg: RequestType,
  sendNotify: boolean = true,
  nestNum: number = 0,
  nestNumTotal: number = 0
): Promise<ResponseType> {
  const exclusionOwner = socket.id;
  // タッチ解除
  await releaseTouchData(driver, exclusionOwner, arg, true);

  const total = nestNumTotal || arg.optionList.length;

  // 直列の非同期で全部実行する
  await arg.optionList
    .map((option, idx) => () => deleteSingleData(driver, socket, arg.collection, option.key, sendNotify, idx, total))
    .reduce((prev, curr) => prev.then(curr), Promise.resolve());

  // 進捗報告(完了)
  if (sendNotify) notifyProgress(socket, total, nestNum + arg.optionList.length);
}

export async function deleteSingleData(
  driver: Driver,
  socket: any,
  collectionName: string,
  key: string,
  sendNotify: boolean = true,
  nestNum: number = 0,
  total: number = 0
): Promise<void> {
  const deleteRelationCollectionMap: {
    [collectionSuffixName: string]: (
      driver: Driver,
      socket: any,
      roomCollectionPrefix: string,
      key: string
    ) => Promise<void>
  } = {
    "actor-list": deleteActorRelation,
    "resource-master-list": deleteResourceMasterRelation,
    "scene-object-list": deleteSceneObjectRelation,
    "scene-layer-list": deleteSceneLayerRelation,
    "scene-list": deleteSceneRelation,
  };
  const {roomCollectionSuffix} = splitCollectionName(collectionName);
  const callAddFunc = deleteRelationCollectionMap[roomCollectionSuffix] || deleteSimple;
  // 進捗報告(処理中)
  if (sendNotify) notifyProgress(socket, total, nestNum);
  await callAddFunc(driver, socket, collectionName, key);
}

const resist: Resister = (driver: Driver, socket: any): void => {
  setEvent<RequestType, ResponseType>(driver, socket, eventName, (driver: Driver, arg: RequestType) => deleteData(driver, socket, arg));
};
export default resist;
