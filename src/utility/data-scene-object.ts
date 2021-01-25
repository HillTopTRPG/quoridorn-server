import Driver from "nekostore/lib/Driver";
import {addDirect} from "../event/add-direct";
import {findList, getData, resistCollectionName, splitCollectionName} from "./collection";
import {addActorRelation} from "./data-actor";
import {addSimple, deleteSimple, getDataForDelete, RelationalDataDeleter, touchCheck} from "./data";
import DocumentSnapshot from "nekostore/lib/DocumentSnapshot";
import {updateDataPackage} from "../event/update-data-package";
import {deleteDataPackage} from "../event/delete-data-package";
import {ImportLevel} from "../@types/socket";

export async function addSceneObjectRelation(
  driver: Driver,
  socket: any,
  collectionName: string,
  data: Partial<StoreUseData<SceneObjectStore>> & { data: SceneObjectStore },
  importLevel?: ImportLevel
): Promise<DocumentSnapshot<StoreData<SceneObjectStore>> | null> {
  const {roomCollectionPrefix} = splitCollectionName(collectionName);

  const sceneObject = data.data;

  // データ整合性調整
  const layerList = (await findList<StoreData<SceneLayerStore>>(
    driver,
    `${roomCollectionPrefix}-DATA-scene-layer-list`
  ))!;
  const layer = layerList.find(l => l.data!.key === sceneObject.layerKey);
  if (!layer) {
    const addLayer = layerList.find(l => l.data!.data!.type.toString() === sceneObject.type);
    if (addLayer) sceneObject.layerKey = addLayer.data!.key;
    else sceneObject.layerKey = layerList[0]!.data!.key;
  }

  // 追加
  const doc = await addSimple<SceneObjectStore>(driver, socket, collectionName, data);
  if (!doc) return null;
  const sceneObjectKey = doc.data!.key;

  // シーンとの紐づけ
  // importLevel:full :: インポートデータに含まれているのでこの処理は不要
  // importLevel:user :: -
  // importLevel:actor:: -
  // importLevel:part :: インポートデータに含まれていないのでこの処理は必要
  if (importLevel !== "full") {
    const sceneAndObjectList =
      (await findList<StoreData<SceneObjectStore>>(
        driver,
        `${roomCollectionPrefix}-DATA-scene-list`
      ))!.map(doc => ({
        ownerType: null,
        owner: null,
        data: {
          sceneKey: doc.data!.key,
          objectKey: sceneObjectKey,
          isOriginalAddress: false,
          originalAddress: null,
          entering: "normal"
        }
      }));
    await addDirect<SceneAndObjectStore>(driver, socket, {
      collection: `${roomCollectionPrefix}-DATA-scene-and-object-list`,
      list: sceneAndObjectList
    }, false);
  }

  if (sceneObject.type === "character") {
    // キャラクターコマの追加

    // アクターの追加・または更新
    // importLevel:full :: インポートデータに含まれているのでこの処理は不要
    // importLevel:user :: インポートデータに含まれているのでこの処理は不要
    // importLevel:actor:: インポートデータに含まれているのでこの処理は不要
    // importLevel:part :: インポートデータに含まれているのでこの処理は不要
    if (!importLevel) {
      if (!sceneObject.actorKey) {
        // 併せてActorの登録も行う
        const actorCCName = `${roomCollectionPrefix}-DATA-actor-list`;
        sceneObject.actorKey = (await addActorRelation(
          driver,
          socket,
          actorCCName,
          {
            data: {
              name: sceneObject.name,
              type: "character",
              chatFontColorType: "owner",
              chatFontColor: "#000000",
              standImagePosition: 1,
              pieceKeyList: [sceneObjectKey],
              tag: "",
              statusKey: "",
              isExported: false
            }
          }
        ))!.data!.key;
        await doc.ref.update({
          data: sceneObject
        });

        // collectionの記録
        await resistCollectionName(driver, actorCCName);
      } else {
        // 既存Actorにコマを追加するパターン
        const actorDoc = await getData<ActorStore>(
          driver,
          `${roomCollectionPrefix}-DATA-actor-list`,
          { key: sceneObject.actorKey }
        );
        if (actorDoc && actorDoc.exists()) {
          const pieceKeyList = actorDoc.data.data!.pieceKeyList as string[];
          if (!pieceKeyList.some(key => key === sceneObjectKey)) {
            pieceKeyList.push(sceneObjectKey);
            await actorDoc.ref.update(actorDoc.data);
          }
        }
      }
    }

    // リソースを追加
    // importLevel:full :: インポートデータに含まれているのでこの処理は不要
    // importLevel:user :: 既存のResourceMasterのものを処理する必要があるのでこの処理は必要
    // importLevel:actor:: 既存のResourceMasterのものを処理する必要があるのでこの処理は必要
    // importLevel:part :: 既存のResourceMasterのものを処理する必要があるのでこの処理は必要
    if (importLevel !== "full") {
      const resourceMasterDocList = (await findList<StoreData<ResourceMasterStore>>(
        driver,
        `${roomCollectionPrefix}-DATA-resource-master-list`,
        [{ property: "data.isAutoAddMapObject", operand: "==", value: true }]
      ))!;
      await addDirect<ResourceStore>(driver, socket, {
        collection: `${roomCollectionPrefix}-DATA-resource-list`,
        list: resourceMasterDocList.map(rmDoc => ({
          ownerType: "scene-object-list",
          owner: sceneObjectKey,
          order: -1,
          data: {
            resourceMasterKey: rmDoc.data!.key,
            type: rmDoc.data!.data!.type,
            value: rmDoc.data!.data!.defaultValue
          }
        }))
      }, false);
    }
  }

  return doc;
}

export async function deleteSceneObjectRelation(
  driver: Driver,
  socket: any,
  collectionName: string,
  key: string
): Promise<void> {
  const docSnap: DocumentSnapshot<StoreData<SceneObjectStore>> = await getDataForDelete(driver, collectionName, key);
  const sceneObject = docSnap.data!;
  const roomCollectionPrefix = collectionName.replace(/-DATA-.+$/, "");
  const deleter: RelationalDataDeleter = new RelationalDataDeleter(driver, roomCollectionPrefix, key);

  if (sceneObject.data!.type === "character") {
    // アクター取得
    const actorKey = sceneObject.data!.actorKey!;
    const actorListCollectionName = `${roomCollectionPrefix}-DATA-actor-list`;
    const actorDoc = await touchCheck<ActorStore>(driver, actorListCollectionName, actorKey);

    // アクターの更新／削除
    const pieceKeyList: string[] = actorDoc.data!.data!.pieceKeyList;
    const idx = pieceKeyList.findIndex(k => k === key);
    pieceKeyList.splice(idx, 1);

    if (pieceKeyList.length) {
      await updateDataPackage(driver, socket, {
        collection: actorListCollectionName,
        list: [{
          key: actorKey,
          data: actorDoc.data
        }]
      });
    } else {
      await deleteDataPackage(driver, socket, {
        collection: actorListCollectionName,
        list: [{ key: actorKey }]
      }, false);
    }

    // リソースを強制的に削除
    await deleter.deleteForce("resource-list", "owner");
  }

  switch (sceneObject.data!.type) {
    case "character": // non-break
    case "map-mask": // non-break
    case "chit": // non-break
    case "map-marker":
      // その他欄を強制的に削除
      await deleter.deleteForce("memo-list", "owner");
      break;
    default:
  }

  // SceneAndObjectを強制的に削除
  await deleter.deleteForce("scene-and-object-list", "data.objectKey");

  await deleteSimple<SceneObjectStore>(driver, socket, collectionName, key);
}
