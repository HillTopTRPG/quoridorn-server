import {Resister} from "../server";
import Driver from "nekostore/lib/Driver";
import {AddRoomPresetDataRequest, LikeStore} from "../@types/socket";
import {addDirect} from "./add-direct";
import {ApplicationError} from "../error/ApplicationError";
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

  const sceneLayerList: SceneLayerStore[] = [
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
      min: -100,
      max: 100,
      interval: 1,
      selectionStr: null,
      defaultValue: "0"
    }
  ];
  const diceTypeList: (Partial<StoreData<DiceTypeStore>> & { data: DiceTypeStore })[] = [];
  let pipsNum: number = 0;
  Object.keys(arg.diceMaterial).forEach(faceNum => {
    arg.diceMaterial[faceNum].forEach(diceType => {
      diceTypeList.push({
        ownerType: null,
        owner: null,
        data: {
          faceNum,
          subType: diceType.type || "",
          label: diceType.label || ""
        }
      });
      pipsNum += Object.keys(diceType.pips).length;
    });
  });

  const counterRemoconList: CounterRemoconStore[] = [
    {
      name: "万能±",
      modifyType: "plus-minus",
      resourceMasterKey: null,
      value: "",
      targetType: "every-one",
      messageFormat: "{0}の{1}を{2}した({3})"
    },
    {
      name: "万能=",
      modifyType: "substitute",
      resourceMasterKey: null,
      value: "",
      targetType: "every-one",
      messageFormat: "{0}の{1}を{2}した({3})"
    }
  ];

  const total =
    diceTypeList.length +
    pipsNum +
    arg.cutInDataList.length +
    sceneLayerList.length +
    resourceMasterList.length +
    arg.likeList.length +
    counterRemoconList.length +
    4;
  let current = 0;

  /* --------------------------------------------------
   * ダイスタイプのプリセットデータ投入
   */
  const diceTypeKeyList = await addDirect<DiceTypeStore>(driver, socket, {
    collection: `${roomCollectionPrefix}-DATA-dice-type-list`,
    list: diceTypeList
  }, true, current, total);
  current += diceTypeList.length;

  /* --------------------------------------------------
   * ダイス目のプリセットデータ投入
   */
  const diceAndPipsList: (Partial<StoreData<DiceAndPipsStore>> & { data: DiceAndPipsStore })[] = [];
  let diceTypeIdx: number = 0;
  Object.keys(arg.diceMaterial).forEach(faceNum => {
    arg.diceMaterial[faceNum].forEach(diceType => {
      const diceTypeKey = diceTypeKeyList[diceTypeIdx++];
      diceAndPipsList.push(...Object.keys(diceType.pips).map(pips => ({
        ownerType: null,
        owner: null,
        data: {
          diceTypeKey,
          pips,
          mediaKey: diceType.pips[pips]
        }
      })));
    });
  });
  await addDirect<DiceAndPipsStore>(driver, socket, {
    collection: `${roomCollectionPrefix}-DATA-dice-and-pips-list`,
    list: diceAndPipsList
  }, true, current, total);
  current += diceAndPipsList.length;

  /* --------------------------------------------------
   * カットインデータのプリセットデータ投入
   */
  await addDirect<CutInStore>(driver, socket, {
    collection: `${roomCollectionPrefix}-DATA-cut-in-list`,
    list: arg.cutInDataList.map(data => ({ ownerType: null, owner: null, data }))
  }, true, current, total);
  current += arg.cutInDataList.length;

  /* --------------------------------------------------
   * マップデータのプリセットデータ投入
   */
  const sceneData = arg.sceneData;
  const sceneKeyList = await addDirect<SceneStore>(driver, socket, {
    collection: `${roomCollectionPrefix}-DATA-scene-list`,
    list: [{ ownerType: null, owner: null, data: sceneData }]
  }, true, current, total);
  current += 1;

  /* --------------------------------------------------
   * マップレイヤーのプリセットデータ投入
   */
  await addDirect<SceneLayerStore>(driver, socket, {
    collection: `${roomCollectionPrefix}-DATA-scene-layer-list`,
    list: sceneLayerList.map(data => ({ ownerType: null, owner: null, data }))
  }, true, current, total);
  current += sceneLayerList.length;

  /* --------------------------------------------------
   * 部屋データのプリセットデータ投入
   */
  await addDirect<RoomDataStore>(driver, socket, {
    collection: `${roomCollectionPrefix}-DATA-room-data`,
    list: [{
      ownerType: null,
      owner: null,
      data: {
        sceneKey: sceneKeyList[0],
        settings: arg.roomExtendInfo,
        name: arg.roomName
      }
    }]
  }, true, current, total);
  current += 1;

  // ActorGroupのIDを取得する関数
  const getActorGroupKey = async (name: string): Promise<string> => {
    const actorGroupDoc = await findSingle<StoreData<ActorGroupStore>>(
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
  await addDirect<ChatTabStore>(driver, socket, {
    collection: `${roomCollectionPrefix}-DATA-chat-tab-list`,
    list: [
      {
        owner: null,
        ownerType: null,
        permission: {
          view: { type: "none", list: [] },
          edit: { type: "allow", list: [gameMastersPermission] },
          chmod: { type: "allow", list: [gameMastersPermission] }
        },
        data: {
          name: arg.language.mainChatTabName,
          isSystem: true,
          useReadAloud: true,
          readAloudVolume: 0.5
        }
      }
    ]
  }, true, current, total);
  current += 1;

  /* --------------------------------------------------
   * グループチャットタブのプリセットデータ投入
   */
  await addDirect<GroupChatTabStore>(driver, socket, {
    collection: `${roomCollectionPrefix}-DATA-group-chat-tab-list`,
    list: [
      {
        ownerType: null,
        owner: null,
        data: {
          name: arg.language.allGroupChatTabName,
          isSystem: true,
          actorGroupKey: await getActorGroupKey("All"),
          isSecret: false,
          outputChatTabKey: null
        }
      }
    ]
  }, true, current, total);
  current += 1;

  /* --------------------------------------------------
   * イニシアティブ表のプリセットデータ投入
   */
  await addDirect<ResourceMasterStore>(driver, socket, {
    collection: `${roomCollectionPrefix}-DATA-resource-master-list`,
    list: resourceMasterList.map(data => ({ owner: null, ownerType: null, data }))
  }, true, current, total);
  current += resourceMasterList.length;

  /* --------------------------------------------------
   * いいねのプリセットデータ投入
   */
  await addDirect<LikeStore>(driver, socket, {
    collection: `${roomCollectionPrefix}-DATA-like-list`,
    list: arg.likeList.map(data => ({ owner: null, ownerType: null, data }))
  }, true, current, total);
  current += arg.likeList.length;

  /* --------------------------------------------------
   * カウンターリモコンのプリセットデータ投入
   */
  await addDirect<CounterRemoconStore>(driver, socket, {
    collection: `${roomCollectionPrefix}-DATA-counter-remocon-list`,
    list: counterRemoconList.map(data => ({ ownerType: null, owner: null, data }))
  }, true, current, total);
}

const resist: Resister = (driver: Driver, socket: any): void => {
  setEvent<RequestType, ResponseType>(driver, socket, eventName, (driver: Driver, arg: RequestType) => addRoomPresetData(driver, socket, arg));
};
export default resist;
