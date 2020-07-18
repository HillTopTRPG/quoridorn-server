import {Resister} from "../server";
import {getSocketDocSnap, setEvent} from "./common";
import Driver from "nekostore/lib/Driver";
import {AddRoomPresetDataRequest} from "../@types/socket";
import {addDirect} from "./add-direct";
import {PermissionNode, StoreObj} from "../@types/store";
import {ApplicationError} from "../error/ApplicationError";
import {ResourceMasterStore} from "../@types/data";

// インタフェース
const eventName = "add-room-preset-data";
type RequestType = AddRoomPresetDataRequest;
type ResponseType = void;

/**
 * 部屋プリセットデータ登録
 * @param driver
 * @param socket
 * @param arg
 */
async function addRoomPresetData(driver: Driver, socket: any, arg: RequestType): Promise<ResponseType> {
  const snap = (await getSocketDocSnap(driver, socket.id));
  const roomCollectionPrefix = snap.data!.roomCollectionPrefix;
  console.log(`【addRoomPresetData】roomCollectionPrefix: ${roomCollectionPrefix}`);

  const sceneLayerList = [
    { type: "floor-tile", defaultOrder: 1, isSystem: true },
    { type: "map-mask", defaultOrder: 2, isSystem: true },
    { type: "map-marker", defaultOrder: 3, isSystem: true },
    { type: "dice-symbol", defaultOrder: 4, isSystem: true },
    { type: "card", defaultOrder: 5, isSystem: true },
    { type: "character", defaultOrder: 6, isSystem: true }
  ];
  const resourceMasterList: ResourceMasterStore[] = [
    {
      label: arg.language.nameLabel,
      type: "ref-normal",
      systemColumnType: "name",
      isAutoAddActor: false,
      isAutoAddMapObject: true,
      iconImageId: null,
      iconImageTag: null,
      iconImageDirection: null,
      refProperty: "name",
      min: null,
      max: null,
      interval: null,
      selectionStr: null,
      defaultValue: ""
    },
    {
      label: "INI",
      type: "number",
      systemColumnType: "initiative",
      isAutoAddActor: false,
      isAutoAddMapObject: true,
      iconImageId: null,
      iconImageTag: null,
      iconImageDirection: null,
      refProperty: null,
      min: -999,
      max: 1000,
      interval: 1,
      selectionStr: null,
      defaultValue: "0"
    }
  ];

  /* --------------------------------------------------
   * メディアデータのプリセットデータ投入
   */
  const total = arg.mediaDataList.length + arg.cutInDataList.length + sceneLayerList.length + resourceMasterList.length + 4;
  let current = 0;
  const mediaIdList = await addDirect(driver, socket, {
    collection: `${roomCollectionPrefix}-DATA-media-list`,
    dataList: arg.mediaDataList,
    optionList: arg.mediaDataList.map(() => ({ owner: null, ownerType: null }))
  }, true, current, total);
  current += arg.mediaDataList.length;

  const backgroundMediaId = mediaIdList[arg.backgroundMediaIndex]!;
  const backgroundMediaTag = arg.mediaDataList[arg.backgroundMediaIndex]!.tag;

  /* --------------------------------------------------
   * カットインデータのプリセットデータ投入
   */
  await addDirect(driver, socket, {
    collection: `${roomCollectionPrefix}-DATA-cut-in-list`,
    dataList: arg.cutInDataList
  }, true, current, total);
  current += arg.cutInDataList.length;

  /* --------------------------------------------------
   * マップデータのプリセットデータ投入
   */
  const sceneData = arg.sceneData;
  if (sceneData.texture.type === "image") {
    sceneData.texture.imageId = backgroundMediaId;
    sceneData.texture.imageTag = backgroundMediaTag;
  }
  if (sceneData.background.texture.type === "image") {
    sceneData.background.texture.imageId = backgroundMediaId;
    sceneData.background.texture.imageTag = backgroundMediaTag;
  }
  if (sceneData.margin.texture.type === "image") {
    sceneData.margin.texture.imageId = backgroundMediaId;
    sceneData.margin.texture.imageTag = backgroundMediaTag;
  }
  const sceneIdList = await addDirect(driver, socket, {
    collection: `${roomCollectionPrefix}-DATA-scene-list`,
    dataList: [sceneData]
  }, true, current, total);
  current += 1;

  /* --------------------------------------------------
   * マップレイヤーのプリセットデータ投入
   */
  await addDirect(driver, socket, {
    collection: `${roomCollectionPrefix}-DATA-scene-layer-list`,
    dataList: sceneLayerList
  }, true, current, total);
  current += sceneLayerList.length;

  /* --------------------------------------------------
   * 部屋データのプリセットデータ投入
   */
  await addDirect(driver, socket, {
    collection: `${roomCollectionPrefix}-DATA-room-data`,
    dataList: [{
      sceneId: sceneIdList[0],
      settings: arg.roomExtendInfo,
      name: arg.roomName
    }]
  }, true, current, total);
  current += 1;

  // ActorGroupのIDを取得する関数
  const getActorGroupId = async (name: string): Promise<string> => {
    const actorGroupDoc = (await driver.collection<StoreObj<any>>(`${roomCollectionPrefix}-DATA-actor-group-list`).where("data.name", "==", name).get()).docs[0];
    if (!actorGroupDoc || !actorGroupDoc.exists()) {
      throw new ApplicationError(`ActorGroup: ${name} is not exist.`);
    }
    return actorGroupDoc.ref.id;
  };

  /* --------------------------------------------------
   * チャットタブのプリセットデータ投入
   */
  const gameMastersPermission: PermissionNode = {
    type: "group",
    id: await getActorGroupId("GameMasters")
  };
  await addDirect(driver, socket, {
    collection: `${roomCollectionPrefix}-DATA-chat-tab-list`,
    dataList: [
      {
        name: arg.language.mainChatTabName,
        isSystem: true,
        useReadAloud: true,
        readAloudVolume: 0.5
      }
    ],
    optionList: [
      {
        permission: {
          view: { type: "none", list: [] },
          edit: { type: "allow", list: [gameMastersPermission] },
          chmod: { type: "allow", list: [gameMastersPermission] }
        }
      }
    ]
  }, true, current, total);
  current += 1;

  /* --------------------------------------------------
   * グループチャットタブのプリセットデータ投入
   */
  await addDirect(driver, socket, {
    collection: `${roomCollectionPrefix}-DATA-group-chat-tab-list`,
    dataList: [
      {
        name: arg.language.allGroupChatTabName,
        isSystem: true,
        actorGroupId: await getActorGroupId("All"),
        isSecret: false,
        outputChatTabId: null
      }
    ]
  }, true, current, total);
  current += 1;

  /* --------------------------------------------------
   * イニシアティブ表のプリセットデータ投入
   */
  await addDirect(driver, socket, {
    collection: `${roomCollectionPrefix}-DATA-resource-master-list`,
    dataList: resourceMasterList,
    optionList: resourceMasterList.map(_ => ({ owner: null, ownerType: null }))
  }, true, current, total);
  current += resourceMasterList.length;
}

const resist: Resister = (driver: Driver, socket: any): void => {
  setEvent<RequestType, ResponseType>(driver, socket, eventName, (driver: Driver, arg: RequestType) => addRoomPresetData(driver, socket, arg));
};
export default resist;
