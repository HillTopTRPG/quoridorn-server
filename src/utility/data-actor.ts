import Driver from "nekostore/lib/Driver";
import {ActorStatusStore, ActorStore, ResourceMasterStore, ResourceStore} from "../@types/data";
import {addDirect} from "../event/add-direct";
import {StoreObj, StoreUseData} from "../@types/store";
import {getOwner, resistCollectionName, splitCollectionName} from "./collection";
import {addSimple, deleteSimple} from "./data";
import {addActorGroup, deleteActorGroup} from "./data-actor-group";
import {procAsyncSplit} from "./async";
import DocumentSnapshot from "nekostore/lib/DocumentSnapshot";

export async function addActorRelation(
  driver: Driver,
  socket: any,
  collectionName: string,
  actorInfoPartial: Partial<ActorStore>,
  option?: Partial<StoreUseData<ActorStore>>
): Promise<DocumentSnapshot<StoreObj<any>>> {
  const {roomCollectionPrefix} = splitCollectionName(collectionName);
  const actorInfo: ActorStore = {
    name: "",
    type: "user",
    tag: "",
    pieceKeyList: [],
    chatFontColorType: "original",
    chatFontColor: "#000000",
    standImagePosition: 1,
    statusKey: ""
  };

  const doc = await addSimple(driver, socket, collectionName, actorInfo, option);
  const actorKey = doc.data!.key;

  // アクターグループ「All」に追加
  const owner = await getOwner(driver, socket.id, option ? option.owner : undefined);
  await addActorGroup(driver, roomCollectionPrefix, "All", actorKey, "other", owner);

  // ステータスを自動追加
  const statusCollectionName = `${roomCollectionPrefix}-DATA-status-list`;
  actorInfoPartial.statusKey = (await addSimple<ActorStatusStore>(
    driver,
    socket,
    statusCollectionName,
    { name: "◆", isSystem: true, standImageInfoKey: null, chatPaletteInfoKey: null },
    { ownerType: "actor", owner: actorKey }
  )).data!.key;
  await resistCollectionName(driver, statusCollectionName);

  const copyParam = <T extends keyof ActorStore>(param: T) => {
    if (actorInfoPartial[param] !== undefined)
      actorInfo[param] = actorInfoPartial[param] as ActorStore[T];
  };
  copyParam("name");
  copyParam("type");
  copyParam("chatFontColorType");
  copyParam("chatFontColor");
  copyParam("standImagePosition");
  copyParam("statusKey");
  copyParam("pieceKeyList");

  await doc.ref.update({
    status: "modified",
    data: actorInfo,
    updateTime: new Date()
  });

  // リソースを自動追加
  const resourceMasterCCName = `${roomCollectionPrefix}-DATA-resource-master-list`;
  const resourceMasterCC = driver.collection<StoreObj<ResourceMasterStore>>(resourceMasterCCName);
  const resourceMasterDocList = (await resourceMasterCC.where("data.isAutoAddActor", "==", true).get()).docs;

  // リソースインスタンスを追加
  await addDirect<ResourceStore>(driver, socket, {
    collection: `${roomCollectionPrefix}-DATA-resource-list`,
    dataList: resourceMasterDocList.map(rmDoc => ({
      masterKey: rmDoc.data!.key,
      type: rmDoc.data!.data!.type,
      value: rmDoc.data!.data!.defaultValue
    })),
    optionList: resourceMasterDocList.map(() => ({
      ownerType: "actor",
      owner: actorKey,
      order: -1
    }))
  }, false);

  return doc;
}

export async function deleteActorRelation(
  driver: Driver,
  socket: any,
  collectionName: string,
  id: string
): Promise<void> {
  const roomCollectionPrefix = collectionName.replace(/-DATA-.+$/, "");

  // アクターグループ「All」から削除
  await deleteActorGroup(driver, roomCollectionPrefix, "All", id);

  // ステータスを強制的に削除
  const statusCollectionName = `${roomCollectionPrefix}-DATA-status-list`;
  const statusColumnCC = driver.collection<ActorStatusStore>(statusCollectionName);
  await procAsyncSplit(
    (await statusColumnCC.where("owner", "==", id).get())
    .docs
    .map(doc => doc.ref.delete())
  );

  // リソースを強制的に削除
  const resourceCC = driver.collection<any>(`${roomCollectionPrefix}-DATA-resource-list`);
  await procAsyncSplit(
    (await resourceCC.where("owner", "==", id).get())
    .docs
    .map(doc => doc.ref.delete())
  );

  // 最後に本体を削除
  await deleteSimple(driver, socket, collectionName, id);
}
