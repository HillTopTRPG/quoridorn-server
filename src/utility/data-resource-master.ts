import Driver from "nekostore/lib/Driver";
import {ActorStore, ResourceMasterStore, ResourceStore} from "../@types/data";
import {StoreObj} from "../@types/store";
import DocumentChange from "nekostore/lib/DocumentChange";
import {addDirect} from "../event/add-direct";
import {resistCollectionName} from "./collection";
import {procAsyncSplit} from "./async";
import DocumentReference from "nekostore/src/DocumentReference";
import {addSimple, deleteSimple, updateSimple} from "./data";

export async function addResourceMasterRelation(
  driver: Driver,
  socket: any,
  collectionName: string,
  resourceMaster: ResourceMasterStore,
  option?: Partial<StoreObj<ResourceMasterStore>>
): Promise<DocumentReference<StoreObj<any>>> {
  const roomCollectionPrefix = collectionName.replace(/-DATA-.+$/, "");
  // まずはリソース定義を追加
  const docRef = await addSimple(driver, socket, collectionName, resourceMaster, option);
  const resourceMasterId = docRef.id;

  const addResources = async (idList: string[], ownerType: string) => {
    // リソースインスタンスを追加
    await addDirect(driver, socket, {
      collection: `${roomCollectionPrefix}-DATA-resource-list`,
      dataList: idList.map(() => ({
        masterId: resourceMasterId,
        type: resourceMaster.type,
        value: resourceMaster.defaultValue
      })),
      optionList: idList.map(id => ({
        ownerType,
        owner: id,
        order: -1
      }))
    }, false);
  };

  // 自動付与（アクター）なら、リソース連携
  if (resourceMaster.isAutoAddActor) {
    // アクター一覧を取得
    const actorCCName = `${roomCollectionPrefix}-DATA-actor-list`;
    const actorCC = driver.collection<StoreObj<ActorStore>>(actorCCName);
    const idList = (await actorCC.get()).docs.map(doc => doc.ref.id);
    await addResources(idList, "actor");
  }

  // 自動付与（コマ）なら、リソース連携
  if (resourceMaster.isAutoAddMapObject) {
    // アクター一覧を取得
    const sceneObjectCCName = `${roomCollectionPrefix}-DATA-scene-object-list`;
    const sceneObjectCC = driver.collection<StoreObj<any>>(sceneObjectCCName);
    const idList = (await sceneObjectCC.get()).docs.map(doc => doc.ref.id);
    await addResources(idList, "scene-object");
  }

  if (resourceMaster.isAutoAddActor || resourceMaster.isAutoAddMapObject) {
    // イニシアティブカラムインスタンスを追加
    const initiativeColumnCollectionName = `${roomCollectionPrefix}-DATA-initiative-column-list`;
    await addSimple(
      driver,
      socket,
      initiativeColumnCollectionName,
      { resourceMasterId },
      { ownerType: null, owner: null }
    );
    await resistCollectionName(driver, initiativeColumnCollectionName);
  }

  return docRef;
}

export async function deleteResourceMasterRelation(
  driver: Driver,
  socket: any,
  collectionName: string,
  id: string
): Promise<void> {
  const roomCollectionPrefix = collectionName.replace(/-DATA-.+$/, "");

  // イニシアティブ表の列を強制的に削除
  const initiativeColumnCC = driver.collection<any>(`${roomCollectionPrefix}-DATA-initiative-column-list`);
  await procAsyncSplit(
    (await initiativeColumnCC.where("data.resourceMasterId", "==", id).get())
      .docs
      .map(doc => doc.ref.delete())
  );

  // リソースを強制的に削除
  const resourceCC = driver.collection<any>(`${roomCollectionPrefix}-DATA-resource-list`);
  await procAsyncSplit(
    (await resourceCC.where("data.masterId", "==", id).get())
      .docs
      .map(doc => doc.ref.delete())
  );

  // 最後に本体を削除
  await deleteSimple(driver, socket, collectionName, id);
}

/**
 * リソースマスターが更新された後の処理
 * @param driver
 * @param socket
 * @param collectionName
 * @param docId
 * @param docData
 */
export async function updateResourceMasterRelation(
  driver: Driver,
  socket: any,
  collectionName: string,
  docId: string,
  docData: ResourceMasterStore
): Promise<void> {
  await updateSimple(driver, socket, collectionName, docId, docData);
  const roomCollectionPrefix = collectionName.replace(/-DATA-.+$/, "");

  const isAutoAddActor = docData.isAutoAddActor;
  const isAutoAddMapObject = docData.isAutoAddMapObject;
  const type = docData.type;
  const defaultValue = docData.defaultValue;

  const resourceCCName = `${roomCollectionPrefix}-DATA-resource-list`;
  const resourceCC = driver.collection<StoreObj<ResourceStore>>(resourceCCName);
  const resourceDocs = (await resourceCC.where("data.masterId", "==", docId).get()).docs;

  /*
   * 種類が変更されたらリソースの値をデフォルト値に更新する
   */
  const updateResource = async (doc: DocumentChange<StoreObj<ResourceStore>>, updateInfo: Partial<ResourceStore>) => {
    doc.data!.updateTime = new Date();
    doc.data!.data!.value = updateInfo.value!;
    doc.data!.data!.type = updateInfo.type!;
    await doc.ref.update(doc.data!);
  };

  // 直列の非同期で全部実行する
  await resourceDocs
    .filter(doc => doc.data!.data!.type !== type)
    .map(doc => () => updateResource(doc, { type, value: defaultValue }))
    .reduce((prev, curr) => prev.then(curr), Promise.resolve());

  /*
   * 必要なリソースを追加（フラグの変更によるリソースの削除は行わない）
   */
  const optionList: Partial<StoreObj<unknown>>[] = [];

  if (isAutoAddActor) {
    const actorCCName = `${roomCollectionPrefix}-DATA-actor-list`;
    const actorCC = driver.collection<StoreObj<ActorStore>>(actorCCName);
    (await actorCC.get()).docs
    .filter(actorDoc =>
      !resourceDocs.filter(
        rDoc => rDoc.data!.ownerType === "actor" && rDoc.data!.owner === actorDoc.ref.id
      )[0]
    )
    .forEach(actorDoc => {
      optionList.push({
        ownerType: "actor",
        owner: actorDoc.ref.id,
        order: -1
      });
    });
  }

  if (isAutoAddMapObject) {
    const sceneObjectCCName = `${roomCollectionPrefix}-DATA-scene-object-list`;
    const sceneObjectCC = driver.collection<StoreObj<any>>(sceneObjectCCName);
    (await sceneObjectCC.get()).docs
    .filter(sceneObjectDoc =>
      !resourceDocs.filter(
        rDoc => rDoc.data!.ownerType === "scene-object" && rDoc.data!.owner === sceneObjectDoc.ref.id
      )[0]
    )
    .forEach(sceneObjectDoc => {
      optionList.push({
        ownerType: "scene-object",
        owner: sceneObjectDoc.ref.id,
        order: -1
      });
    });
  }

  const initiativeColumnCCName = `${roomCollectionPrefix}-DATA-initiative-column-list`;
  const initiativeColumnCC = driver.collection<StoreObj<any>>(initiativeColumnCCName);
  const initiativeColumnDoc = (await initiativeColumnCC.where("data.resourceMasterId", "==", docId).get()).docs[0];

  if (isAutoAddActor || isAutoAddMapObject) {
    // リソースインスタンスを追加
    if (optionList.length) {
      await addDirect(driver, socket, {
        collection: `${roomCollectionPrefix}-DATA-resource-list`,
        dataList: optionList.map(() => ({
          masterId: docId,
          type: docData.type,
          value: docData.defaultValue
        })),
        optionList
      }, false);
    }

    // イニシアティブ表の表示に追加
    if (!initiativeColumnDoc || !initiativeColumnDoc.exists()) {
      await addDirect(driver, socket, {
        collection: `${roomCollectionPrefix}-DATA-initiative-column-list`,
        dataList: [{
          resourceMasterId: docId
        }],
        optionList: [{
          ownerType: null,
          owner: null
        }]
      }, false);
    }
  } else {
    if (initiativeColumnDoc && initiativeColumnDoc.exists()) {
      await initiativeColumnDoc.ref.delete();
    }
  }
}
