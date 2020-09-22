import Driver from "nekostore/lib/Driver";
import {ActorStore, InitiativeColumnStore, ResourceMasterStore, ResourceStore, SceneObject} from "../@types/data";
import {StoreObj, StoreUseData} from "../@types/store";
import DocumentChange from "nekostore/lib/DocumentChange";
import {addDirect} from "../event/add-direct";
import {findList, findSingle, resistCollectionName, splitCollectionName} from "./collection";
import {procAsyncSplit} from "./async";
import {addSimple, deleteSimple, updateSimple} from "./data";
import DocumentSnapshot from "nekostore/lib/DocumentSnapshot";

export async function addResourceMasterRelation(
  driver: Driver,
  socket: any,
  collectionName: string,
  resourceMaster: ResourceMasterStore,
  option?: Partial<StoreUseData<ResourceMasterStore>>
): Promise<DocumentSnapshot<StoreObj<any>>> {
  const roomCollectionPrefix = collectionName.replace(/-DATA-.+$/, "");
  // まずはリソース定義を追加
  const doc = await addSimple(driver, socket, collectionName, resourceMaster, option);
  const resourceMasterKey = doc.data!.key;

  const addResources = async (keyList: string[], ownerType: string) => {
    // リソースインスタンスを追加
    await addDirect<ResourceStore>(driver, socket, {
      collection: `${roomCollectionPrefix}-DATA-resource-list`,
      dataList: keyList.map(() => ({
        masterKey: resourceMasterKey,
        type: resourceMaster.type,
        value: resourceMaster.defaultValue
      })),
      optionList: keyList.map(key => ({
        ownerType,
        owner: key,
        order: -1
      }))
    }, false);
  };

  // 自動付与（アクター）なら、リソース連携
  if (resourceMaster.isAutoAddActor) {
    // アクター一覧を取得
    const actorCCName = `${roomCollectionPrefix}-DATA-actor-list`;
    const keyList = (await findList<StoreObj<ActorStore>>(driver, actorCCName))!.map(
      doc => doc.data!.key
    );
    await addResources(keyList, "actor");
  }

  // 自動付与（コマ）なら、リソース連携
  if (resourceMaster.isAutoAddMapObject) {
    // アクター一覧を取得
    const sceneObjectCCName = `${roomCollectionPrefix}-DATA-scene-object-list`;
    const keyList = (await findList<StoreObj<SceneObject>>(
      driver,
      sceneObjectCCName,
      [{ property: "data.type", operand: "==", value: "character" }]
    ))!.map(doc => doc.data!.key);
    await addResources(keyList, "scene-object");
  }

  if (resourceMaster.isAutoAddActor || resourceMaster.isAutoAddMapObject) {
    // イニシアティブカラムインスタンスを追加
    const initiativeColumnCollectionName = `${roomCollectionPrefix}-DATA-initiative-column-list`;
    await addSimple(
      driver,
      socket,
      initiativeColumnCollectionName,
      { resourceMasterKey },
      { ownerType: null, owner: null }
    );
    await resistCollectionName(driver, initiativeColumnCollectionName);
  }

  return doc;
}

export async function deleteResourceMasterRelation(
  driver: Driver,
  socket: any,
  collectionName: string,
  key: string
): Promise<void> {
  const {roomCollectionPrefix} = splitCollectionName(collectionName);

  // イニシアティブ表の列を強制的に削除
  await procAsyncSplit(
    (await findList<StoreObj<InitiativeColumnStore>>(
      driver,
      `${roomCollectionPrefix}-DATA-initiative-column-list`,
      [{ property: "data.resourceMasterKey", operand: "==", value: key }])
    )!.map(doc => doc.ref.delete())
  );

  // リソースを強制的に削除
  await procAsyncSplit(
    (await findList<StoreObj<ResourceStore>>(
        driver,
        `${roomCollectionPrefix}-DATA-resource-list`,
        [{ property: "data.masterKey", operand: "==", value: key }])
    )!.map(doc => doc.ref.delete())
  );

  // 最後に本体を削除
  await deleteSimple(driver, socket, collectionName, key);
}

/**
 * リソースマスターが更新された後の処理
 * @param driver
 * @param socket
 * @param collectionName
 * @param docData
 * @param option
 */
export async function updateResourceMasterRelation(
  driver: Driver,
  socket: any,
  collectionName: string,
  docData: ResourceMasterStore,
  option: (Partial<StoreObj<ResourceMasterStore>> & { key: string; continuous?: boolean; })
): Promise<void> {
  await updateSimple(driver, socket, collectionName, docData, option);
  const {roomCollectionPrefix} = splitCollectionName(collectionName);

  const isAutoAddActor = docData.isAutoAddActor;
  const isAutoAddMapObject = docData.isAutoAddMapObject;
  const type = docData.type;
  const defaultValue = docData.defaultValue;

  const resourceCCName = `${roomCollectionPrefix}-DATA-resource-list`;
  const resourceDocs = (await findList<StoreObj<ResourceStore>>(
    driver,
    resourceCCName,
    [{ property: "data.masterKey", operand: "==", value: option.key }]
  ))!;

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
  const optionList: Partial<StoreObj<ResourceStore>>[] = [];

  if (isAutoAddActor) {
    (await findList<StoreObj<ActorStore>>(driver, `${roomCollectionPrefix}-DATA-actor-list`))!
      .filter(actorDoc =>
        !resourceDocs.some(
          rDoc => rDoc.data!.ownerType === "actor" && rDoc.data!.owner === actorDoc.data!.key
        )
      )
      .forEach(actorDoc => {
        optionList.push({
          ownerType: "actor",
          owner: actorDoc.data!.key,
          order: -1
        });
      });
  }

  if (isAutoAddMapObject) {
    (await findList<StoreObj<SceneObject>>(driver, `${roomCollectionPrefix}-DATA-scene-object-list`))!
      .filter(sceneObjectDoc =>
        !resourceDocs.some(
          rDoc => rDoc.data!.ownerType === "scene-object" && rDoc.data!.owner === sceneObjectDoc.data!.key
        )
      )
      .forEach(sceneObjectDoc => {
        optionList.push({
          ownerType: "scene-object",
          owner: sceneObjectDoc.data!.key,
          order: -1
        });
      });
  }

  const initiativeColumnDoc = (await findSingle<StoreObj<InitiativeColumnStore>>(
    driver,
    `${roomCollectionPrefix}-DATA-initiative-column-list`,
    "data.resourceMasterKey",
    option.key
  ))!;

  if (isAutoAddActor || isAutoAddMapObject) {
    // リソースインスタンスを追加
    if (optionList.length) {
      await addDirect<ResourceStore>(driver, socket, {
        collection: `${roomCollectionPrefix}-DATA-resource-list`,
        dataList: optionList.map(() => ({
          masterKey: option.key,
          type: docData.type,
          value: docData.defaultValue
        })),
        optionList
      }, false);
    }

    // イニシアティブ表の表示に追加
    if (!initiativeColumnDoc || !initiativeColumnDoc.exists()) {
      await addDirect<InitiativeColumnStore>(driver, socket, {
        collection: `${roomCollectionPrefix}-DATA-initiative-column-list`,
        dataList: [{ resourceMasterKey: option.key }],
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
