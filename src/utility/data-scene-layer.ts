import Driver from "nekostore/lib/Driver";
import {addDirect} from "../event/add-direct";
import {addSimple, deleteSimple, multipleTouchCheck} from "./data";
import {deleteDataPackage} from "../event/delete-data-package";
import {findList, splitCollectionName} from "./collection";
import DocumentSnapshot from "nekostore/lib/DocumentSnapshot";

export async function addSceneLayerRelation(
  driver: Driver,
  socket: any,
  collectionName: string,
  data: Partial<StoreData<SceneLayerStore>> & { data: SceneLayerStore }
): Promise<DocumentSnapshot<StoreData<SceneLayerStore>> | null> {
  const {roomCollectionPrefix} = splitCollectionName(collectionName);

  // データ整合性調整
  const sceneList = (await findList<StoreData<SceneStore>>(
    driver,
    `${roomCollectionPrefix}-DATA-scene-list`
  ))!;

  // 追加
  const doc = await addSimple(driver, socket, collectionName, data);
  if (!doc) return null;

  // シーンオブジェクトの追加
  // 現存する各シーンすべてに今回登録したシーンオブジェクトを紐づかせる

  const sceneAndLayerList = sceneList.map(scene => ({
    ownerType: null,
    owner: null,
    data: {
      sceneKey: scene.data!.key,
      layerKey: doc.data!.key,
      isUse: true
    }
  }));
  await addDirect<SceneAndLayerStore>(driver, socket, {
    collection: `${roomCollectionPrefix}-DATA-scene-and-layer-list`,
    list: sceneAndLayerList
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
    list: sceneAndLayerDocChangeList.map(sal => ({ key: sal.data!.key }))
  }, false);

  await deleteSimple<any>(driver, socket, collectionName, key);
}
