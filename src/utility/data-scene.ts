import Driver from "nekostore/lib/Driver";
import {addDirect} from "../event/add-direct";
import {addSimple, deleteSimple, multipleTouchCheck} from "./data";
import {StoreObj} from "../@types/store";
import DocumentReference from "nekostore/src/DocumentReference";
import {deleteDataPackage} from "../event/delete-data-package";

export async function addSceneRelation(
  driver: Driver,
  socket: any,
  collectionName: string,
  scene: any,
  option?: Partial<StoreObj<any>>
): Promise<DocumentReference<StoreObj<any>>> {
  const roomCollectionPrefix = collectionName.replace(/-DATA-.+$/, "");
  const docRef = await addSimple(driver, socket, collectionName, scene, option);
  const sceneId = docRef.id;

  // シーンレイヤーの追加
  const sceneLayerListCCName = `${roomCollectionPrefix}-DATA-scene-layer-list`;
  const sceneLayerListCC = driver.collection<any>(sceneLayerListCCName);
  // 現存する各シーンすべてに今回登録したシーンオブジェクトを紐づかせる
  const sceneAndLayerList = (await sceneLayerListCC.get()).docs.map(doc => ({
    sceneId,
    layerId: doc.ref.id,
    isUse: true
  }));
  await addDirect(driver, socket, {
    collection: `${roomCollectionPrefix}-DATA-scene-and-layer-list`,
    dataList: sceneAndLayerList
  }, false);

  // シーンオブジェクトの追加
  const sceneObjectListCCName = `${roomCollectionPrefix}-DATA-scene-object-list`;
  const sceneObjectListCC = driver.collection<any>(sceneObjectListCCName);
  // 現存する各シーンすべてに今回登録したシーンオブジェクトを紐づかせる
  const sceneAndObjectList = (await sceneObjectListCC.get()).docs.map(doc => ({
    sceneId,
    objectId: doc.ref.id,
    isOriginalAddress: false,
    originalAddress: null,
    entering: "normal"
  }));
  await addDirect(driver, socket, {
    collection: `${roomCollectionPrefix}-DATA-scene-and-object-list`,
    dataList: sceneAndObjectList
  }, false);

  return docRef;
}

export async function deleteSceneRelation(
  driver: Driver,
  socket: any,
  collectionName: string,
  id: string
): Promise<void> {
  const roomCollectionPrefix = collectionName.replace(/-DATA-.+$/, "");

  // SceneAndObjectが削除できる状態かをチェック
  const sceneAndLayerCCName = `${roomCollectionPrefix}-DATA-scene-and-layer-list`;
  const sceneAndLayerDocChangeList = await multipleTouchCheck(driver, sceneAndLayerCCName, "data.sceneId", id);

  // SceneAndObjectが削除できる状態かをチェック
  const sceneAndObjectCCName = `${roomCollectionPrefix}-DATA-scene-and-object-list`;
  const sceneAndObjectDocChangeList = await multipleTouchCheck(driver, sceneAndObjectCCName, "data.sceneId", id);

  // SceneAndObjectの削除
  await deleteDataPackage(driver, socket, {
    collection: sceneAndLayerCCName,
    idList: sceneAndLayerDocChangeList.map(rdc => rdc.ref.id)
  }, false);

  // SceneAndObjectの削除
  await deleteDataPackage(driver, socket, {
    collection: sceneAndObjectCCName,
    idList: sceneAndObjectDocChangeList.map(rdc => rdc.ref.id)
  }, false);

  await deleteSimple<any>(driver, socket, collectionName, id);
}
