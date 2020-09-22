import Driver from "nekostore/lib/Driver";
import {addDirect} from "../event/add-direct";
import {StoreObj, StoreUseData} from "../@types/store";
import {addSimple, deleteSimple, multipleTouchCheck} from "./data";
import {deleteDataPackage} from "../event/delete-data-package";
import {findList, splitCollectionName} from "./collection";
import {SceneAndLayer, SceneObject} from "../@types/data";
import DocumentSnapshot from "nekostore/lib/DocumentSnapshot";

export async function addSceneLayerRelation(
  driver: Driver,
  socket: any,
  collectionName: string,
  sceneLayer: any,
  option?: Partial<StoreUseData<any>>
): Promise<DocumentSnapshot<StoreObj<any>>> {
  const {roomCollectionPrefix} = splitCollectionName(collectionName);
  const doc = await addSimple(driver, socket, collectionName, sceneLayer, option);
  const sceneLayerKey = doc.data!.key;

  // シーンオブジェクトの追加
  // 現存する各シーンすべてに今回登録したシーンオブジェクトを紐づかせる

  const sceneAndLayerList = (await findList<StoreObj<SceneObject>>(driver, `${roomCollectionPrefix}-DATA-scene-list`))!.map(doc => ({
    sceneKey: doc.data!.key,
    layerKey: sceneLayerKey,
    isUse: true
  }));
  await addDirect<SceneAndLayer>(driver, socket, {
    collection: `${roomCollectionPrefix}-DATA-scene-and-layer-list`,
    dataList: sceneAndLayerList
  }, false);

  return doc;
}

export async function deleteSceneLayerRelation(
  driver: Driver,
  socket: any,
  collectionName: string,
  key: string
): Promise<void> {
  const {roomCollectionPrefix} = splitCollectionName(collectionName);

  // SceneAndObjectが削除できる状態かをチェック
  const sceneAndLayerCCName = `${roomCollectionPrefix}-DATA-scene-and-layer-list`;
  const sceneAndLayerDocChangeList = await multipleTouchCheck(driver, sceneAndLayerCCName, "data.layerKey", key);

  // SceneAndObjectの削除
  await deleteDataPackage(driver, socket, {
    collection: sceneAndLayerCCName,
    optionList: sceneAndLayerDocChangeList.map(sal => ({ key: sal.data!.key }))
  }, false);

  await deleteSimple<any>(driver, socket, collectionName, key);
}
