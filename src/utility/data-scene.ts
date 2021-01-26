import Driver from "nekostore/lib/Driver";
import {addDirect} from "../event/add-direct";
import {addSimple, deleteSimple, RelationalDataDeleter} from "./data";
import {findList, splitCollectionName} from "./collection";
import DocumentSnapshot from "nekostore/lib/DocumentSnapshot";
import {ImportLevel} from "../@types/socket";

export async function addSceneRelation(
  driver: Driver,
  socket: any,
  collectionName: string,
  data: Partial<StoreUseData<SceneObjectStore>> & { data: SceneObjectStore },
  importLevel?: ImportLevel
): Promise<DocumentSnapshot<StoreData<SceneObjectStore>> | null> {
  const {roomCollectionPrefix} = splitCollectionName(collectionName);
  const doc = await addSimple(driver, socket, collectionName, data);
  if (!doc) return null;
  const sceneKey = doc.data!.key;

  // 現存シーンレイヤーとの紐づきの追加
  // importLevel:full :: インポートデータに含まれているのでこの処理は不要
  // importLevel:user :: インポートデータに含まれていないのでこの処理は必要
  // importLevel:actor:: インポートデータに含まれていないのでこの処理は必要
  // importLevel:part :: インポートデータに含まれていないのでこの処理は必要
  if (importLevel !== "full") {
    const sceneAndLayerList = (await findList<StoreData<SceneLayerStore>>(
        driver,
        `${roomCollectionPrefix}-DATA-scene-layer-list`
    ))!.map(doc => ({
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
  }

  // シーンオブジェクトの追加
  // importLevel:full :: インポートデータに含まれているのでこの処理は不要
  // importLevel:user :: インポートデータに含まれていないのでこの処理は必要
  // importLevel:actor:: インポートデータに含まれていないのでこの処理は必要
  // importLevel:part :: インポートデータに含まれていないのでこの処理は必要
  if (importLevel !== "full") {
    const sceneAndObjectList = (await findList<StoreData<SceneObjectStore>>(
      driver,
      `${roomCollectionPrefix}-DATA-scene-object-list`
    ))!
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
  }

  return doc;
}

export async function deleteSceneRelation(
  driver: Driver,
  socket: any,
  collectionName: string,
  key: string
): Promise<void> {
  const roomCollectionPrefix = collectionName.replace(/-DATA-.+$/, "");
  const deleter: RelationalDataDeleter = new RelationalDataDeleter(driver, roomCollectionPrefix, key);

  // SceneAndLayerを強制的に削除
  await deleter.deleteForce("scene-and-layer-list", "data.sceneKey");

  // SceneAndObjectを強制的に削除
  await deleter.deleteForce("scene-and-object-list", "data.sceneKey");

  await deleteSimple<any>(driver, socket, collectionName, key);
}
