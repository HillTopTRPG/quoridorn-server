import Driver from "nekostore/lib/Driver";
import {addDirect} from "../event/add-direct";
import {StoreObj} from "../@types/store";
import {addSimple, deleteSimple, multipleTouchCheck} from "./data";
import DocumentReference from "nekostore/src/DocumentReference";
import {deleteDataPackage} from "../event/delete-data-package";

export async function addSceneLayerRelation(
  driver: Driver,
  socket: any,
  collectionName: string,
  sceneLayer: any,
  option?: Partial<StoreObj<any>>
): Promise<DocumentReference<StoreObj<any>>> {
  const roomCollectionPrefix = collectionName.replace(/-DATA-.+$/, "");
  const docRef = await addSimple(driver, socket, collectionName, sceneLayer, option);
  const sceneLayerId = docRef.id;

  // シーンオブジェクトの追加
  const sceneListCCName = `${roomCollectionPrefix}-DATA-scene-list`;
  const sceneListCC = driver.collection<any>(sceneListCCName);
  // 現存する各シーンすべてに今回登録したシーンオブジェクトを紐づかせる
  const sceneAndLayerList = (await sceneListCC.get()).docs.map(doc => ({
    sceneId: doc.ref.id,
    layerId: sceneLayerId,
    isUse: true
  }));
  await addDirect(driver, socket, {
    collection: `${roomCollectionPrefix}-DATA-scene-and-layer-list`,
    dataList: sceneAndLayerList
  }, false);

  return docRef;
}

export async function deleteSceneLayerRelation(
  driver: Driver,
  socket: any,
  collectionName: string,
  id: string
): Promise<void> {
  const roomCollectionPrefix = collectionName.replace(/-DATA-.+$/, "");

  // SceneAndObjectが削除できる状態かをチェック
  const sceneAndLayerCCName = `${roomCollectionPrefix}-DATA-scene-and-layer-list`;
  const sceneAndLayerDocChangeList = await multipleTouchCheck(driver, sceneAndLayerCCName, "data.layerId", id);

  // SceneAndObjectの削除
  await deleteDataPackage(driver, socket, {
    collection: sceneAndLayerCCName,
    idList: sceneAndLayerDocChangeList.map(rdc => rdc.ref.id)
  }, false);

  await deleteSimple<any>(driver, socket, collectionName, id);
}
