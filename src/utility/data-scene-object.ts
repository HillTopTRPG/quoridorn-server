import Driver from "nekostore/lib/Driver";
import {StoreObj} from "../@types/store";
import {addDirect} from "../event/add-direct";
import {getData, resistCollectionName} from "./collection";
import {ResourceMasterStore, SceneAndObject, SceneObject} from "../@types/data";
import {addActorRelation} from "./data-actor";
import DocumentReference from "nekostore/src/DocumentReference";
import {addSimple, deleteSimple, getDataForDelete, multipleTouchCheck, touchCheck} from "./data";
import DocumentSnapshot from "nekostore/lib/DocumentSnapshot";
import {updateDataPackage} from "../event/update-data-package";
import {deleteDataPackage} from "../event/delete-data-package";

export async function addSceneObjectRelation(
  driver: Driver,
  socket: any,
  collectionName: string,
  sceneObject: SceneObject,
  option?: Partial<StoreObj<SceneObject>>
): Promise<DocumentReference<StoreObj<SceneObject>>> {
  const roomCollectionPrefix = collectionName.replace(/-DATA-.+$/, "");
  const docRef = await addSimple(driver, socket, collectionName, sceneObject, option);
  const sceneObjectId = docRef.id;

  // シーンオブジェクトの追加
  const sceneListCCName = `${roomCollectionPrefix}-DATA-scene-list`;
  const sceneListCC = driver.collection<SceneObject>(sceneListCCName);
  // 現存する各シーンすべてに今回登録したシーンオブジェクトを紐づかせる
  const sceneAndObjectList: SceneAndObject[] = (await sceneListCC.get()).docs.map(doc => ({
    sceneId: doc.ref.id,
    objectId: sceneObjectId,
    isOriginalAddress: false,
    originalAddress: null,
    entering: "normal"
  }));
  await addDirect(driver, socket, {
    collection: `${roomCollectionPrefix}-DATA-scene-and-object-list`,
    dataList: sceneAndObjectList
  }, false);

  if (sceneObject.type === "character") {
    // キャラクターコマの追加

    // アクターの追加の場合
    if (!sceneObject.actorId) {
      // 併せてActorの登録も行う
      const actorCCName = `${roomCollectionPrefix}-DATA-actor-list`;
      sceneObject.actorId = (await addActorRelation(
        driver,
        socket,
        actorCCName,
        {
          name: sceneObject.name,
          type: "character",
          chatFontColorType: "owner",
          chatFontColor: "#000000",
          standImagePosition: 1,
          pieceIdList: [sceneObjectId]
        }
      )).id;
      await docRef.update({
        data: sceneObject
      });

      // collectionの記録
      await resistCollectionName(driver, actorCCName);
    } else {
      // 既存Actorにコマを追加するパターン
      const actorDocSnap = await getData(
        driver,
        `${roomCollectionPrefix}-DATA-actor-list`,
        sceneObject.actorId,
        {}
      );
      if (actorDocSnap && actorDocSnap.exists()) {
        (actorDocSnap.data.data.pieceIdList as string[]).push(sceneObjectId);
        await actorDocSnap.ref.update(actorDocSnap.data.data);
      }
    }

    // リソースの自動追加
    const resourceMasterCCName = `${roomCollectionPrefix}-DATA-resource-master-list`;
    const resourceMasterCC = driver.collection<StoreObj<ResourceMasterStore>>(resourceMasterCCName);
    const resourceMasterDocList = (await resourceMasterCC.where("data.isAutoAddMapObject", "==", true).get()).docs;

    // リソースインスタンスを追加
    await addDirect(driver, socket, {
      collection: `${roomCollectionPrefix}-DATA-resource-list`,
      dataList: resourceMasterDocList.map(rmDoc => ({
        masterId: rmDoc.ref.id,
        type: rmDoc.data!.data!.type,
        value: rmDoc.data!.data!.defaultValue
      })),
      optionList: resourceMasterDocList.map(() => ({
        ownerType: "scene-object",
        owner: sceneObjectId,
        order: -1
      }))
    }, false);
  }

  return docRef;
}

export async function deleteSceneObjectRelation(
  driver: Driver,
  socket: any,
  collectionName: string,
  id: string
): Promise<void> {
  const docSnap: DocumentSnapshot<StoreObj<SceneObject>> = await getDataForDelete(driver, collectionName, id);
  const sceneObject = docSnap.data!;
  const roomCollectionPrefix = collectionName.replace(/-DATA-.+$/, "");

  if (sceneObject.data!.type === "character") {
    // リソースが削除できる状態かをチェック
    const resourceCCName = `${roomCollectionPrefix}-DATA-resource-list`;
    const resourceDocChangeList = await multipleTouchCheck(driver, resourceCCName, "owner", id);

    // SceneAndObjectが削除できる状態かをチェック
    const sceneAndObjectCCName = `${roomCollectionPrefix}-DATA-scene-and-object-list`;
    const sceneAndObjectDocChangeList = await multipleTouchCheck(driver, sceneAndObjectCCName, "data.objectId", id);

    // アクターが削除できる状態かをチェック
    const actorId = sceneObject.data!.actorId!;
    const actorListCollectionName = `${roomCollectionPrefix}-DATA-actor-list`;
    const actorDocSnap = await touchCheck(driver, actorListCollectionName, actorId);

    // リソースの削除
    await deleteDataPackage(driver, socket, {
      collection: resourceCCName,
      idList: resourceDocChangeList.map(rdc => rdc.ref.id)
    }, false);

    // SceneAndObjectの削除
    await deleteDataPackage(driver, socket, {
      collection: sceneAndObjectCCName,
      idList: sceneAndObjectDocChangeList.map(rdc => rdc.ref.id)
    }, false);

    // アクターの更新／削除
    const pieceIdList: string[] = actorDocSnap.data!.data.pieceIdList;
    const idx = pieceIdList.findIndex(pid => pid === id);
    pieceIdList.splice(idx, 1);

    if (pieceIdList.length) {
      await updateDataPackage(driver, socket, {
        collection: actorListCollectionName,
        idList: [actorId],
        dataList: [actorDocSnap.data]
      });
    } else {
      await deleteDataPackage(driver, socket, {
        collection: actorListCollectionName,
        idList: [actorId]
      }, false);
    }
  }

  await deleteSimple<SceneObject>(driver, socket, collectionName, id);
}
