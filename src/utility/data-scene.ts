import Driver from "nekostore/lib/Driver";
import {addDirect} from "../event/add-direct";
import {addSimple, deleteSimple, multipleTouchCheck} from "./data";
import {deleteDataPackage} from "../event/delete-data-package";
import {findList, splitCollectionName} from "./collection";
import DocumentSnapshot from "nekostore/lib/DocumentSnapshot";

export async function addSceneRelation(
  driver: Driver,
  socket: any,
  collectionName: string,
  data: Partial<StoreUseData<SceneObjectStore>> & { data: SceneObjectStore }
): Promise<DocumentSnapshot<StoreData<SceneObjectStore>> | null> {
  const {roomCollectionPrefix} = splitCollectionName(collectionName);
  const doc = await addSimple(driver, socket, collectionName, data);
  if (!doc) return null;
  const sceneKey = doc.data!.key;

  // シーンレイヤーの追加
  const sceneLayerListCCName = `${roomCollectionPrefix}-DATA-scene-layer-list`;
  // 現存する各シーンすべてに今回登録したシーンオブジェクトを紐づかせる
  const sceneAndLayerList = (await findList<StoreData<SceneLayerStore>>(driver, sceneLayerListCCName))!.map(doc => ({
    data: {
      sceneKey,
      layerKey: doc.data!.key,
      isUse: true
    }
  }));
  await addDirect<SceneAndLayerStore>(driver, socket, {
    collection: `${roomCollectionPrefix}-DATA-scene-and-layer-list`,
    list: sceneAndLayerList
  }, false);

  // シーンオブジェクトの追加
  const sceneAndObjectList = (await findList<StoreData<SceneObjectStore>>(driver, `${roomCollectionPrefix}-DATA-scene-object-list`))!
    .map(doc => ({
      data: {
        sceneKey,
        objectKey: doc.data!.key,
        isOriginalAddress: false,
        originalAddress: null,
        entering: "normal"
      }
    }));
  // 現存する各シーンすべてに今回登録したシーンオブジェクトを紐づかせる
  await addDirect<SceneAndObjectStore>(driver, socket, {
    collection: `${roomCollectionPrefix}-DATA-scene-and-object-list`,
    list: sceneAndObjectList
  }, false);

  return doc;
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
  const sceneAndLayerDocChangeList = await multipleTouchCheck(driver, sceneAndLayerCCName, "data.sceneKey", id);

  // SceneAndObjectが削除できる状態かをチェック
  const sceneAndObjectCCName = `${roomCollectionPrefix}-DATA-scene-and-object-list`;
  const sceneAndObjectDocChangeList = await multipleTouchCheck(driver, sceneAndObjectCCName, "data.sceneKey", id);

  // SceneAndObjectの削除
  await deleteDataPackage(driver, socket, {
    collection: sceneAndLayerCCName,
    list: sceneAndLayerDocChangeList.map(sal => ({ key: sal.data!.key }))
  }, false);

  // SceneAndObjectの削除
  await deleteDataPackage(driver, socket, {
    collection: sceneAndObjectCCName,
    list: sceneAndObjectDocChangeList.map(sao => ({ key: sao.data!.key }))
  }, false);

  await deleteSimple<any>(driver, socket, collectionName, id);
}
