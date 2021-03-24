import Driver from "nekostore/lib/Driver";
import DocumentChange from "nekostore/lib/DocumentChange";
import {addDirect} from "../event/add-direct";
import {findList, findSingle, resistCollectionName, splitCollectionName} from "./collection";
import {addSimple, deleteSimple, RelationalDataDeleter, updateSimple} from "./data";
import DocumentSnapshot from "nekostore/lib/DocumentSnapshot";
import {ImportLevel} from "../@types/socket";

export async function addResourceMasterRelation(
  driver: Driver,
  socket: any,
  collectionName: string,
  data: Partial<StoreData<ResourceMasterStore>> & { data: ResourceMasterStore },
  importLevel?: ImportLevel
): Promise<DocumentSnapshot<StoreData<ResourceMasterStore>> | null> {
  const roomCollectionPrefix = collectionName.replace(/-DATA-.+$/, "");
  // まずはリソース定義を追加
  const doc = await addSimple(driver, socket, collectionName, data);
  if (!doc) return null;
  const resourceMasterKey = doc.data!.key;

  const resourceMaster =  data.data;

  // リソース追加
  // importLevel:full :: インポートデータに含まれているのでこの処理は不要
  // importLevel:user :: 他のactorに紐づくデータは含まれていないのでこの処理は必要
  // importLevel:actor:: 他のactorに紐づくデータは含まれていないのでこの処理は必要
  // importLevel:part :: インポートデータに含まれていないのでこの処理は必要
  if (importLevel !== "full") {
    const addResources = async (keyList: string[], ownerType: string) => {
      // リソースインスタンスを追加
      await addDirect<ResourceStore>(driver, socket, {
        collection: `${roomCollectionPrefix}-DATA-resource-list`,
        list: keyList.map(key => ({
          ownerType,
          owner: key,
          order: -1,
          data: {
            resourceMasterKey: resourceMasterKey,
            type: resourceMaster.type,
            value: resourceMaster.defaultValue
          }
        }))
      }, false);
    };

    // 自動付与（アクター）なら、リソース連携
    if (resourceMaster.isAutoAddActor) {
      // アクター一覧を取得
      const actorCCName = `${roomCollectionPrefix}-DATA-actor-list`;
      const keyList = (await findList<StoreData<ActorStore>>(driver, actorCCName))!.map(
          doc => doc.data!.key
      );
      await addResources(keyList, "actor-list");
    }

    // 自動付与（コマ）なら、リソース連携
    if (resourceMaster.isAutoAddMapObject) {
      // アクター一覧を取得
      const sceneObjectCCName = `${roomCollectionPrefix}-DATA-scene-object-list`;
      const keyList = (await findList<StoreData<SceneAndObjectStore>>(
          driver,
          sceneObjectCCName,
          [{property: "data.type", operand: "==", value: "character"}]
      ))!.map(doc => doc.data!.key);
      await addResources(keyList, "scene-object-list");
    }
  }

  // イニシアティブカラムインスタンスを追加
  // importLevel:full :: インポートデータに含まれているのでこの処理は不要
  // importLevel:user :: インポートデータに含まれているのでこの処理は不要
  // importLevel:actor:: インポートデータに含まれているのでこの処理は不要
  // importLevel:part :: インポートデータに含まれているのでこの処理は不要
  if (!importLevel) {
    if (resourceMaster.isAutoAddActor || resourceMaster.isAutoAddMapObject) {
      const initiativeColumnCollectionName = `${roomCollectionPrefix}-DATA-initiative-column-list`;
      const initiativeColumnData = await findSingle(
        driver,
        initiativeColumnCollectionName,
        "data.resourceMasterKey",
        resourceMasterKey
      );
      if (!initiativeColumnData) {
        await addSimple(
          driver,
          socket,
          initiativeColumnCollectionName,
          { ownerType: null, owner: null, data: { resourceMasterKey } }
        );
        await resistCollectionName(driver, initiativeColumnCollectionName);
      }
    }
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
  const deleter: RelationalDataDeleter = new RelationalDataDeleter(driver, roomCollectionPrefix, key);

  // イニシアティブ表の列を強制的に削除
  await deleter.deleteForce(
    "initiative-column-list",
    "data.resourceMasterKey"
  );

  // リソースを強制的に削除
  await deleter.deleteForce(
    "resource-list",
    "data.resourceMasterKey"
  );

  // カウンターリモコンを強制的に削除
  await deleter.deleteForce(
    "counter-remocon-list",
    "data.resourceMasterKey"
  );

  // 最後に本体を削除
  await deleteSimple(driver, socket, collectionName, key);
}

/**
 * リソースマスターが更新された後の処理
 * @param driver
 * @param socket
 * @param collectionName
 * @param data
 */
export async function updateResourceMasterRelation(
  driver: Driver,
  socket: any,
  collectionName: string,
  data: (Partial<StoreData<ResourceMasterStore>> & { key: string; continuous?: boolean; })
): Promise<void> {
  console.log("#### updateResourceMasterRelation");
  await updateSimple(driver, socket, collectionName, data);
  const {roomCollectionPrefix} = splitCollectionName(collectionName);

  console.log(!data.data);
  if (!data.data) return;

  const isAutoAddActor = data.data.isAutoAddActor;
  const isAutoAddMapObject = data.data.isAutoAddMapObject;
  const type = data.data.type;
  const defaultValue = data.data.defaultValue;
  console.log(JSON.stringify({
    isAutoAddActor,
    isAutoAddMapObject,
    type,
    defaultValue
  }, null, "  "));

  const resourceCCName = `${roomCollectionPrefix}-DATA-resource-list`;
  const resourceDocs = (await findList<StoreData<ResourceStore>>(
    driver,
    resourceCCName,
    [{ property: "data.resourceMasterKey", operand: "==", value: data.key }]
  ))!;

  /*
   * 種類が変更されたらリソースの値をデフォルト値に更新する
   */
  const updateResource = async (doc: DocumentChange<StoreData<ResourceStore>>, updateInfo: Partial<ResourceStore>) => {
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
  const list: (Partial<StoreData<ResourceStore>> & { data: ResourceStore })[] = [];

  if (isAutoAddActor) {
    (await findList<StoreData<ActorStore>>(driver, `${roomCollectionPrefix}-DATA-actor-list`))!
      .filter(actorDoc =>
        !resourceDocs.some(
          rDoc => rDoc.data!.ownerType === "actor-list" && rDoc.data!.owner === actorDoc.data!.key
        )
      )
      .forEach(actorDoc => {
        list.push({
          ownerType: "actor-list",
          owner: actorDoc.data!.key,
          order: -1,
          data: {
            resourceMasterKey: data.key,
            type: data.data!.type,
            value: data.data!.defaultValue
          }
        });
      });
  }

  if (isAutoAddMapObject) {
    (await findList<StoreData<SceneAndObjectStore>>(driver, `${roomCollectionPrefix}-DATA-scene-object-list`))!
      .filter(sceneObjectDoc =>
        !resourceDocs.some(
          rDoc => rDoc.data!.ownerType === "scene-object-list" && rDoc.data!.owner === sceneObjectDoc.data!.key
        )
      )
      .forEach(sceneObjectDoc => {
        list.push({
          ownerType: "scene-object-list",
          owner: sceneObjectDoc.data!.key,
          order: -1,
          data: {
            resourceMasterKey: data.key,
            type: data.data!.type,
            value: data.data!.defaultValue
          }
        });
      });
  }

  const initiativeColumnDoc = (await findSingle<StoreData<InitiativeColumnStore>>(
    driver,
    `${roomCollectionPrefix}-DATA-initiative-column-list`,
    "data.resourceMasterKey",
    data.key
  ))!;

  console.log("POINT XRP");
  console.log(JSON.stringify(list, null, "  "));

  if (isAutoAddActor || isAutoAddMapObject) {
    // リソースインスタンスを追加
    if (list.length) {
      await addDirect<ResourceStore>(
        driver,
        socket,
        {
          collection: `${roomCollectionPrefix}-DATA-resource-list`,
          list
        },
        false
      )
    }

    // イニシアティブ表の表示に追加
    if (!initiativeColumnDoc || !initiativeColumnDoc.exists()) {
      await addDirect<InitiativeColumnStore>(
        driver,
        socket,
        {
          collection: `${roomCollectionPrefix}-DATA-initiative-column-list`,
          list: [{
            ownerType: null,
            owner: null,
            data: { resourceMasterKey: data.key }
          }]
        },
        false
      );
    }
  } else {
    if (initiativeColumnDoc && initiativeColumnDoc.exists()) {
      await initiativeColumnDoc.ref.delete();
    }
  }
}
