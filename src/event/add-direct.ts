import {StoreObj} from "../@types/store";
import {Resister} from "../server";
import Driver from "nekostore/lib/Driver";
import {AddDirectRequest} from "../@types/socket";
import {addActorRelation} from "../utility/data-actor";
import {addUserRelation} from "../utility/data-user";
import {resistCollectionName, splitCollectionName} from "../utility/collection";
import {setEvent} from "../utility/server";
import {addResourceMasterRelation} from "../utility/data-resource-master";
import {addSceneRelation} from "../utility/data-scene";
import {addSceneObjectRelation} from "../utility/data-scene-object";
import {addSceneLayerRelation} from "../utility/data-scene-layer";
import {notifyProgress} from "../utility/emit";
import {addSimple} from "../utility/data";
import DocumentSnapshot from "nekostore/lib/DocumentSnapshot";

// インタフェース
const eventName = "add-direct";
type RequestType<T> = AddDirectRequest<T>;
type ResponseType = string[];

export function getAddRelationCollectionMap(): {
  [collectionSuffixName: string]: (
    driver: Driver,
    socket: any,
    collectionName: string,
    data: Partial<StoreObj<any>> & { data: any }
  ) => Promise<DocumentSnapshot<StoreObj<any>> | null>
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
export async function addDirect<T>(
  driver: Driver,
  socket: any,
  arg: RequestType<T>,
  sendNotify: boolean = true,
  nestNum: number = 0,
  nestNumTotal: number = 0
): Promise<ResponseType> {
  const addRelationCollectionMap = getAddRelationCollectionMap();

  const keyList: string[] = [];
  const total = nestNumTotal || arg.list.length;

  const { roomCollectionSuffix } = splitCollectionName(arg.collection);
  const callAddFunc = addRelationCollectionMap[roomCollectionSuffix] || addSimple;

  const addSingleData = async (data: Partial<StoreObj<T>> & { data: T }, idx: number): Promise<void> => {
    // 進捗報告(処理中)
    if (sendNotify) notifyProgress(socket, total, nestNum + idx);

    // データを追加し、idをリストに追加
    const doc = await callAddFunc(
      driver,
      socket,
      arg.collection,
      data
    );
    if (!doc) return;
    keyList.push(doc.data!.key);
  };

  // collectionの記録
  await resistCollectionName(driver, arg.collection);

  // 直列の非同期で全部実行する
  await arg.list
    .map((data, idx) => () => addSingleData(data, idx))
    .reduce((prev, curr) => prev.then(curr), Promise.resolve());

  // 進捗報告(完了)
  if (sendNotify) notifyProgress(socket, total, nestNum + arg.list.length);

  return keyList;
}

const resist: Resister = (driver: Driver, socket: any): void => {
  setEvent<RequestType<any>, ResponseType>(driver, socket, eventName, (driver: Driver, arg: RequestType<any>) => addDirect(driver, socket, arg));
};
export default resist;
