import Driver from "nekostore/lib/Driver";
import {StoreObj, StoreUseData} from "../@types/store";
import {addDirect} from "../event/add-direct";
import {findList, getData, resistCollectionName, splitCollectionName} from "./collection";
import {ActorStore, ResourceMasterStore, ResourceStore, SceneAndObject, SceneObject} from "../@types/data";
import {addActorRelation} from "./data-actor";
import {addSimple, deleteSimple, getDataForDelete, multipleTouchCheck, touchCheck} from "./data";
import DocumentSnapshot from "nekostore/lib/DocumentSnapshot";
import {updateDataPackage} from "../event/update-data-package";
import {deleteDataPackage} from "../event/delete-data-package";

export async function addSceneObjectRelation(
  driver: Driver,
  socket: any,
  collectionName: string,
  sceneObject: SceneObject,
  option?: Partial<StoreUseData<SceneObject>>
): Promise<DocumentSnapshot<StoreObj<SceneObject>>> {
  const {roomCollectionPrefix} = splitCollectionName(collectionName);
  const doc = await addSimple<SceneObject>(driver, socket, collectionName, sceneObject, option);
  const sceneObjectKey = doc.data!.key;

  // シーンオブジェクトの追加
  const sceneListCCName = `${roomCollectionPrefix}-DATA-scene-list`;
  // 現存する各シーンすべてに今回登録したシーンオブジェクトを紐づかせる
  const sceneAndObjectList =
    (await findList<StoreObj<SceneObject>>(driver, sceneListCCName))!.map(doc => ({
      sceneKey: doc.data!.key,
      objectKey: sceneObjectKey,
      isOriginalAddress: false,
      originalAddress: null,
      entering: "normal"
    }));
  await addDirect<SceneAndObject>(driver, socket, {
    collection: `${roomCollectionPrefix}-DATA-scene-and-object-list`,
    dataList: sceneAndObjectList
  }, false);

  if (sceneObject.type === "character") {
    // キャラクターコマの追加

    // アクターの追加の場合
    if (!sceneObject.actorKey) {
      // 併せてActorの登録も行う
      const actorCCName = `${roomCollectionPrefix}-DATA-actor-list`;
      sceneObject.actorKey = (await addActorRelation(
        driver,
        socket,
        actorCCName,
        {
          name: sceneObject.name,
          type: "character",
          chatFontColorType: "owner",
          chatFontColor: "#000000",
          standImagePosition: 1,
          pieceKeyList: [sceneObjectKey]
        }
      )).data!.key;
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
        (actorDoc.data.data!.pieceKeyList as string[]).push(sceneObjectKey);
        await actorDoc.ref.update(actorDoc.data);
      }
    }

    // リソースの自動追加
    const resourceMasterCCName = `${roomCollectionPrefix}-DATA-resource-master-list`;
    const resourceMasterDocList = (await findList<StoreObj<ResourceMasterStore>>(
      driver,
      resourceMasterCCName,
      [{ property: "data.isAutoAddMapObject", operand: "==", value: true }]
    ))!;

    // リソースインスタンスを追加
    await addDirect<ResourceStore>(driver, socket, {
      collection: `${roomCollectionPrefix}-DATA-resource-list`,
      dataList: resourceMasterDocList.map(rmDoc => ({
        masterKey: rmDoc.data!.key,
        type: rmDoc.data!.data!.type,
        value: rmDoc.data!.data!.defaultValue
      })),
      optionList: resourceMasterDocList.map(() => ({
        ownerType: "scene-object",
        owner: sceneObjectKey,
        order: -1
      }))
    }, false);
  }

  return doc;
}

export async function deleteSceneObjectRelation(
  driver: Driver,
  socket: any,
  collectionName: string,
  key: string
): Promise<void> {
  const docSnap: DocumentSnapshot<StoreObj<SceneObject>> = await getDataForDelete(driver, collectionName, key);
  const sceneObject = docSnap.data!;
  const roomCollectionPrefix = collectionName.replace(/-DATA-.+$/, "");

  switch (sceneObject.data!.type) {
    case "character": // non-break
    case "map-mask": // non-break
    case "chit": // non-break
    case "map-marker":
      // memoが削除できる状態かをチェック
      const memoCCName = `${roomCollectionPrefix}-DATA-memo-list`;
      const memoDocChangeList = await multipleTouchCheck(driver, memoCCName, "owner", key);

      // memoの削除
      if (memoDocChangeList.length) {
        await deleteDataPackage(driver, socket, {
          collection: memoCCName,
          optionList: memoDocChangeList.map(m => ({ key: m.data!.key }))
        }, false);
      }
      break;
    default:
  }

  if (sceneObject.data!.type === "character") {
    // リソースが削除できる状態かをチェック
    const resourceCCName = `${roomCollectionPrefix}-DATA-resource-list`;
    const resourceDocChangeList = await multipleTouchCheck(driver, resourceCCName, "owner", key);

    // SceneAndObjectが削除できる状態かをチェック
    const sceneAndObjectCCName = `${roomCollectionPrefix}-DATA-scene-and-object-list`;
    const sceneAndObjectDocChangeList = await multipleTouchCheck(driver, sceneAndObjectCCName, "data.objectKey", key);

    // アクターが削除できる状態かをチェック
    const actorKey = sceneObject.data!.actorKey!;
    const actorListCollectionName = `${roomCollectionPrefix}-DATA-actor-list`;
    const actorDoc = await touchCheck<ActorStore>(driver, actorListCollectionName, actorKey);

    // リソースの削除
    if (resourceDocChangeList.length) {
      await deleteDataPackage(driver, socket, {
        collection: resourceCCName,
        optionList: resourceDocChangeList.map(r => ({ key: r.data!.key }))
      }, false);
    }

    // SceneAndObjectの削除
    if (sceneAndObjectDocChangeList.length) {
      await deleteDataPackage(driver, socket, {
        collection: sceneAndObjectCCName,
        optionList: sceneAndObjectDocChangeList.map(sao => ({ key: sao.data!.key }))
      }, false);
    }

    // アクターの更新／削除
    const pieceKeyList: string[] = actorDoc.data!.data!.pieceKeyList;
    const idx = pieceKeyList.findIndex(k => k === key);
    pieceKeyList.splice(idx, 1);

    if (pieceKeyList.length) {
      await updateDataPackage(driver, socket, {
        collection: actorListCollectionName,
        dataList: [actorDoc.data],
        optionList: [{ key: actorKey }]
      });
    } else {
      await deleteDataPackage(driver, socket, {
        collection: actorListCollectionName,
        optionList: [{ key: actorKey }]
      }, false);
    }
  }

  await deleteSimple<SceneObject>(driver, socket, collectionName, key);
}
