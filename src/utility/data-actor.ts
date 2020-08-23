import Driver from "nekostore/lib/Driver";
import {ActorStatusStore, ActorStore, ResourceMasterStore} from "../@types/data";
import {addDirect} from "../event/add-direct";
import {StoreObj} from "../@types/store";
import {getOwner, resistCollectionName} from "./collection";
import DocumentReference from "nekostore/src/DocumentReference";
import {addSimple} from "./data";
import {addActorGroup} from "./data-actor-group";

export async function addActorRelation(
  driver: Driver,
  socket: any,
  collectionName: string,
  actorInfoPartial: Partial<ActorStore>,
  option?: Partial<StoreObj<ActorStore>>
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

  const docRef = await addSimple(driver, socket, collectionName, actorInfo, option);
  const actorId = docRef.id;

  // アクターグループ「All」に追加
  const owner = await getOwner(driver, socket.id, option ? option.owner : undefined);
  await addActorGroup(driver, roomCollectionPrefix, "All", actorId, "other", owner);

  // ステータスを自動追加
  const statusCollectionName = `${roomCollectionPrefix}-DATA-status-list`;
  actorInfoPartial.statusId = (await addSimple<ActorStatusStore>(
    driver,
    socket,
    `${roomCollectionPrefix}-DATA-status-list`,
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
