import Driver from "nekostore/lib/Driver";
import {ActorStatusStore, ActorStore, ResourceMasterStore} from "../@types/data";
import {addDirect} from "../event/add-direct";
import {StoreObj} from "../@types/store";
import {getOwner, resistCollectionName} from "./collection";
import DocumentReference from "nekostore/src/DocumentReference";
import {addSimple, deleteSimple} from "./data";
import {addActorGroup, deleteActorGroup} from "./data-actor-group";
import {procAsyncSplit} from "./async";

export async function addActorRelation(
  driver: Driver,
  socket: any,
  collectionName: string,
  actorInfoPartial: Partial<ActorStore>,
  option?: Partial<StoreObj<ActorStore>>,
  id?: string
): Promise<DocumentReference<StoreObj<any>>> {
  const roomCollectionPrefix = collectionName.replace(/-DATA-.+$/, "");
  const actorInfo: ActorStore = {
    name: "",
    type: "user",
    tag: "",
    pieceIdList: [],
    chatFontColorType: "original",
    chatFontColor: "#000000",
    standImagePosition: 1,
    statusId: ""
  };

  const docRef = await addSimple(driver, socket, collectionName, actorInfo, option, id);
  const actorId = docRef.id;

  // アクターグループ「All」に追加
  const owner = await getOwner(driver, socket.id, option ? option.owner : undefined);
  await addActorGroup(driver, roomCollectionPrefix, "All", actorId, "other", owner);

  // ステータスを自動追加
  const statusCollectionName = `${roomCollectionPrefix}-DATA-status-list`;
  actorInfoPartial.statusId = (await addSimple<ActorStatusStore>(
    driver,
    socket,
    statusCollectionName,
    { name: "◆", isSystem: true, standImageInfoId: null, chatPaletteInfoId: null },
    { ownerType: "actor", owner: actorId }
  )).id;
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
  copyParam("statusId");
  copyParam("pieceIdList");

  await docRef.update({
    status: "modified",
    data: actorInfo,
    updateTime: new Date()
  });

  // リソースを自動追加
  const resourceMasterCCName = `${roomCollectionPrefix}-DATA-resource-master-list`;
  const resourceMasterCC = driver.collection<StoreObj<ResourceMasterStore>>(resourceMasterCCName);
  const resourceMasterDocList = (await resourceMasterCC.where("data.isAutoAddActor", "==", true).get()).docs;

  // リソースインスタンスを追加
  await addDirect(driver, socket, {
    collection: `${roomCollectionPrefix}-DATA-resource-list`,
    dataList: resourceMasterDocList.map(rmDoc => ({
      masterId: rmDoc.ref.id,
      type: rmDoc.data!.data!.type,
      value: rmDoc.data!.data!.defaultValue
    })),
    optionList: resourceMasterDocList.map(() => ({
      ownerType: "actor",
      owner: actorId,
      order: -1
    }))
  }, false);

  return docRef;
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
