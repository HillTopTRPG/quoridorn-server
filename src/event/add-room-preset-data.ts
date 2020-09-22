import {Resister} from "../server";
import Driver from "nekostore/lib/Driver";
import {AddRoomPresetDataRequest, LikeStore} from "../@types/socket";
import {addDirect} from "./add-direct";
import {PermissionNode, StoreObj} from "../@types/store";
import {ApplicationError} from "../error/ApplicationError";
import {
  ActorGroup, ChatTabInfo,
  CutInDeclareInfo,
  DiceAndPips,
  DiceType,
  GroupChatTabInfo,
  ResourceMasterStore,
  RoomData,
  Scene,
  SceneLayer
} from "../@types/data";
import {setEvent} from "../utility/server";
import {findSingle, getSocketDocSnap} from "../utility/collection";

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

  const sceneLayerList: SceneLayer[] = [
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
      icon: {
        mediaTag: null,
        mediaKey: null,
        imageDirection: null
      },
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
      icon: {
        mediaTag: null,
        mediaKey: null,
        imageDirection: null
      },
      refProperty: null,
      min: -999,
      max: 1000,
      interval: 1,
      selectionStr: null,
      defaultValue: "0"
    }
  ];
  const diceTypeList: DiceType[] = [];
  let pipsNum: number = 0;
  Object.keys(arg.diceMaterial).forEach(faceNum => {
    arg.diceMaterial[faceNum].forEach(diceType => {
      diceTypeList.push({
        faceNum,
        subType: diceType.type || "",
        label: diceType.label || ""
      });
      pipsNum += Object.keys(diceType.pips).length;
    });
  });

  const total =
    diceTypeList.length +
    pipsNum +
    arg.cutInDataList.length +
    sceneLayerList.length +
    resourceMasterList.length +
    arg.likeList.length +
    4;
  let current = 0;

  /* --------------------------------------------------
   * ダイスタイプのプリセットデータ投入
   */
  const diceTypeKeyList = await addDirect<DiceType>(driver, socket, {
    collection: `${roomCollectionPrefix}-DATA-dice-type-list`,
    dataList: diceTypeList,
    optionList: diceTypeList.map(() => ({ ownerType: null, owner: null }))
  }, true, current, total);
  current += diceTypeList.length;

  /* --------------------------------------------------
   * ダイス目のプリセットデータ投入
   */
  const diceAndPipsList: DiceAndPips[] = [];
  let diceTypeIdx: number = 0;
  Object.keys(arg.diceMaterial).forEach(faceNum => {
    arg.diceMaterial[faceNum].forEach(diceType => {
      const diceTypeKey = diceTypeKeyList[diceTypeIdx++];
      diceAndPipsList.push(...Object.keys(diceType.pips).map(pips => ({
        diceTypeKey,
        pips,
        mediaKey: diceType.pips[pips]
      })));
    });
  });
  await addDirect<DiceAndPips>(driver, socket, {
    collection: `${roomCollectionPrefix}-DATA-dice-and-pips-list`,
    dataList: diceAndPipsList,
    optionList: diceAndPipsList.map(() => ({ ownerType: null, owner: null }))
  }, true, current, total);
  current += diceAndPipsList.length;

  /* --------------------------------------------------
   * カットインデータのプリセットデータ投入
   */
  await addDirect<CutInDeclareInfo>(driver, socket, {
    collection: `${roomCollectionPrefix}-DATA-cut-in-list`,
    dataList: arg.cutInDataList,
    optionList: arg.cutInDataList.map(() => ({ ownerType: null, owner: null }))
  }, true, current, total);
  current += arg.cutInDataList.length;

  /* --------------------------------------------------
   * マップデータのプリセットデータ投入
   */
  const sceneData = arg.sceneData;
  const sceneKeyList = await addDirect<Scene>(driver, socket, {
    collection: `${roomCollectionPrefix}-DATA-scene-list`,
    dataList: [sceneData],
    optionList: [{ ownerType: null, owner: null }]
  }, true, current, total);
  current += 1;

  /* --------------------------------------------------
   * マップレイヤーのプリセットデータ投入
   */
  await addDirect<SceneLayer>(driver, socket, {
    collection: `${roomCollectionPrefix}-DATA-scene-layer-list`,
    dataList: sceneLayerList,
    optionList: sceneLayerList.map(() => ({ ownerType: null, owner: null }))
  }, true, current, total);
  current += sceneLayerList.length;

  /* --------------------------------------------------
   * 部屋データのプリセットデータ投入
   */
  await addDirect<RoomData>(driver, socket, {
    collection: `${roomCollectionPrefix}-DATA-room-data`,
    dataList: [{
      sceneKey: sceneKeyList[0],
      settings: arg.roomExtendInfo,
      name: arg.roomName
    }],
    optionList: [{ ownerType: null, owner: null }]
  }, true, current, total);
  current += 1;

  // ActorGroupのIDを取得する関数
  const getActorGroupKey = async (name: string): Promise<string> => {
    const actorGroupDoc = await findSingle<StoreObj<ActorGroup>>(
      driver,
      `${roomCollectionPrefix}-DATA-actor-group-list`,
      "data.name",
      name
    );
    if (!actorGroupDoc) {
      throw new ApplicationError(`ActorGroup: ${name} is not exist.`);
    }
    return actorGroupDoc.data!.key;
  };

  /* --------------------------------------------------
   * チャットタブのプリセットデータ投入
   */
  const gameMastersPermission: PermissionNode = {
    type: "group",
    key: await getActorGroupKey("GameMasters")
  };
  await addDirect<ChatTabInfo>(driver, socket, {
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
  await addDirect<GroupChatTabInfo>(driver, socket, {
    collection: `${roomCollectionPrefix}-DATA-group-chat-tab-list`,
    dataList: [
      {
        name: arg.language.allGroupChatTabName,
        isSystem: true,
        actorGroupKey: await getActorGroupKey("All"),
        isSecret: false,
        outputChatTabKey: null
      }
    ],
    optionList: [{ ownerType: null, owner: null }]
  }, true, current, total);
  current += 1;

  /* --------------------------------------------------
   * イニシアティブ表のプリセットデータ投入
   */
  await addDirect<ResourceMasterStore>(driver, socket, {
    collection: `${roomCollectionPrefix}-DATA-resource-master-list`,
    dataList: resourceMasterList,
    optionList: resourceMasterList.map(() => ({ owner: null, ownerType: null }))
  }, true, current, total);
  current += resourceMasterList.length;

  /* --------------------------------------------------
   * いいねのプリセットデータ投入
   */
  await addDirect<LikeStore>(driver, socket, {
    collection: `${roomCollectionPrefix}-DATA-like-list`,
    dataList: arg.likeList,
    optionList: arg.likeList.map(() => ({ owner: null, ownerType: null }))
  }, true, current, total);
}

const resist: Resister = (driver: Driver, socket: any): void => {
  setEvent<RequestType, ResponseType>(driver, socket, eventName, (driver: Driver, arg: RequestType) => addRoomPresetData(driver, socket, arg));
};
export default resist;
