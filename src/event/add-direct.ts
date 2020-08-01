import {StoreObj} from "../@types/store";
import {Resister} from "../server";
import Driver from "nekostore/lib/Driver";
import {AddDirectRequest} from "../@types/socket";
import {addActorRelation} from "../utility/data-actor";
import {addUserRelation} from "../utility/data-user";
import {resistCollectionName} from "../utility/collection";
import {setEvent} from "../utility/server";
import {addResourceMasterRelation} from "../utility/data-resource-master";
import {addSceneRelation} from "../utility/data-scene";
import {addSceneObjectRelation} from "../utility/data-scene-object";
import {addSceneLayerRelation} from "../utility/data-scene-layer";
import {notifyProgress} from "../utility/emit";
import DocumentReference from "nekostore/src/DocumentReference";
import {addSimple} from "../utility/data";

// インタフェース
const eventName = "add-direct";
type RequestType = AddDirectRequest;
type ResponseType = string[];

export function getAddRelationCollectionMap(): {
  [collectionSuffixName: string]: (
    driver: Driver,
    socket: any,
    roomCollectionPrefix: string,
    actorInfoPartial: any,
    option?: Partial<StoreObj<any>>
  ) => Promise<DocumentReference<StoreObj<any>>>
} {
  return {
    "resource-master-list": addResourceMasterRelation,
    "actor-list": addActorRelation,
    "scene-list": addSceneRelation,
    "scene-object-list": addSceneObjectRelation,
    "user-list": addUserRelation,
    "scene-layer-list": addSceneLayerRelation
  };
}

/**
 * データ作成処理
 * @param driver
 * @param socket
 * @param arg
 * @param sendNotify
 * @param nestNum
 * @param nestNumTotal
 */
export async function addDirect(
  driver: Driver,
  socket: any,
  arg: RequestType,
  sendNotify: boolean = true,
  nestNum: number = 0,
  nestNumTotal: number = 0
): Promise<ResponseType> {
  const addRelationCollectionMap = getAddRelationCollectionMap();

  const docIdList: string[] = [];
  const total = nestNumTotal || arg.dataList.length;

  const collectionSuffixName = arg.collection.replace(/^.+-DATA-/, "");
  const callAddFunc = addRelationCollectionMap[collectionSuffixName] || addSimple;

  const addSingleData = async (data: any, idx: number): Promise<void> => {
    // 進捗報告(処理中)
    if (sendNotify) notifyProgress(socket, total, nestNum + idx);

    // データを追加し、idをリストに追加
    docIdList.push((await callAddFunc(
      driver,
      socket,
      arg.collection,
      data,
      arg.optionList ? arg.optionList[idx] : undefined
    )).id);
  };

  // collectionの記録
  await resistCollectionName(driver, arg.collection);

  // 直列の非同期で全部実行する
  await arg.dataList
    .map((data: any, idx: number) => () => addSingleData(data, idx))
    .reduce((prev, curr) => prev.then(curr), Promise.resolve());

  // 進捗報告(完了)
  if (sendNotify) notifyProgress(socket, total, nestNum + arg.dataList.length);

  return docIdList;
}

const resist: Resister = (driver: Driver, socket: any): void => {
  setEvent<RequestType, ResponseType>(driver, socket, eventName, (driver: Driver, arg: RequestType) => addDirect(driver, socket, arg));
};
export default resist;
