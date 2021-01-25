import Driver from "nekostore/lib/Driver";
import {addDirect} from "../event/add-direct";
import {addSimple, deleteSimple, RelationalDataDeleter} from "./data";
import {findList, splitCollectionName} from "./collection";
import DocumentSnapshot from "nekostore/lib/DocumentSnapshot";
import {ImportLevel} from "../@types/socket";

export async function addSceneLayerRelation(
  driver: Driver,
  socket: any,
  collectionName: string,
  data: Partial<StoreData<SceneLayerStore>> & { data: SceneLayerStore },
  importLevel?: ImportLevel
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

  // シーンとの紐づけ
  // importLevel:full :: インポートデータに含まれているのでこの処理は不要
  // importLevel:user :: インポートデータに含まれているのでこの処理は不要
  // importLevel:actor:: isExportedになるのでこの処理は不要
  // importLevel:part :: isExportedになるのでこの処理は不要
  if (importLevel !== "full") {
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
  }

  return doc;
}

export async function deleteSceneLayerRelation(
  driver: Driver,
  socket: any,
  collectionName: string,
  key: string
): Promise<void> {
  const {roomCollectionPrefix} = splitCollectionName(collectionName);
  const deleter: RelationalDataDeleter = new RelationalDataDeleter(driver, roomCollectionPrefix, key);

  // SceneAndLayerを強制的に削除
  await deleter.deleteForce("scene-and-layer-list", "data.layerKey");

  await deleteSimple<any>(driver, socket, collectionName, key);
}
