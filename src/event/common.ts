import Driver from "nekostore/lib/Driver";
import DocumentSnapshot from "nekostore/lib/DocumentSnapshot";
import {Permission, StoreMetaData, StoreObj} from "../@types/store";
import {hashAlgorithm, PERMISSION_DEFAULT, PERMISSION_OWNER_CHANGE, SYSTEM_COLLECTION} from "../server";
import {SystemError} from "../error/SystemError";
import {UploadFileInfo, UserLoginResponse, UserType} from "../@types/socket";
import {ApplicationError} from "../error/ApplicationError";
import CollectionReference from "nekostore/src/CollectionReference";
import DocumentChange from "nekostore/lib/DocumentChange";
import Query from "nekostore/lib/Query";
import {hash} from "../utility/password";
import {accessLog, errorLog} from "../utility/logger";
import {
  ActorGroup,
  ActorStatusStore,
  ActorStore,
  ResourceMasterStore,
  ResourceStore,
  RoomStore,
  SocketStore,
  TouchierStore,
  UserStore
} from "../@types/data";
import {addDirect} from "./add-direct";
import DocumentReference from "nekostore/src/DocumentReference";
import uuid = require("uuid");

/**
 * リクエスト処理を登録するための関数。
 * @param driver
 * @param socket
 * @param eventName
 * @param func
 */
export function setEvent<T, U>(driver: Driver, socket: any, eventName: string, func: (driver: Driver, arg: T, permission?: Permission) => Promise<U>) {
  const resultEvent = `result-${eventName}`;
  socket.on(eventName, async (arg: T) => {
    const logArg = arg ? JSON.parse(JSON.stringify(arg)) : null;
    if (eventName === "upload-file") {
      logArg.forEach((info: UploadFileInfo) => {
        info.src = "[Binary Array]";
      });
    }
    accessLog(socket.id, eventName, "START", logArg);
    try {
      const result = await func(driver, arg);
      accessLog(socket.id, eventName, "END  ", result);
      socket.emit(resultEvent, null, result);
    } catch (err) {
      // アクセスログは必ず閉じる
      accessLog(socket.id, eventName, "ERROR");

      // エラーの内容はエラーログを見て欲しい（アクセスログはシンプルにしたい）
      const errorMessage = "message" in err ? err.message : err;
      errorLog(socket.id, eventName, errorMessage);

      socket.emit(resultEvent, err, null);
    }
  });
}

export function getStoreObj<T>(
  doc: DocumentSnapshot<StoreObj<T>>
): (StoreObj<T> & StoreMetaData) | null {
  if (doc.exists()) {
    const data: StoreObj<T> = doc.data;
    return {
      ...data,
      id: doc.ref.id,
    };
  } else {
    return null;
  }
}

type GetDataOption<T> = {
  exclusionOwner?: string;
  id?: string;
  collectionReference?: CollectionReference<StoreObj<T>>;
};

export async function resistCollectionName(driver: Driver, collection: string) {
  const roomCollectionPrefix = collection.replace(/-DATA-.+$/, "");
  const collectionNameCollectionName = `${roomCollectionPrefix}-DATA-collection-list`;
  const cnCC = driver.collection<{ name: string }>(collectionNameCollectionName);
  if (!(await cnCC.where("name", "==", collection).get()).docs.length) {
    await cnCC.add({ name: collection });
  }
}

export function notifyProgress(socket: any, all: number, current: number) {
  if (all > 1) socket.emit("notify-progress", null, { all, current });
}

/**
 * 部屋情報コレクションから特定の部屋の情報を取得する
 * @param driver
 * @param roomNo
 * @param option
 */
export async function getRoomInfo(
  driver: Driver,
  roomNo: number,
  option: GetDataOption<RoomStore> = {}
): Promise<DocumentSnapshot<StoreObj<RoomStore>> | null> {
  const collectionReference = option.collectionReference || driver.collection<StoreObj<RoomStore>>(SYSTEM_COLLECTION.ROOM_LIST);
  const roomDocList = (await collectionReference.where("order", "==", roomNo).get()).docs;

  if (!roomDocList.length) return null;

  // 部屋情報が複数件取得できてしまった場合
  // 仕様上考慮しなくていいとされてきたuuidが重複してしまった本当の想定外エラー
  if (roomDocList.length > 1)
    throw new SystemError(`Duplicate room info. Please report to server administrator. room-no=${roomNo}`);

  // 排他チェック
  if (option.exclusionOwner !== undefined) {
    const data = roomDocList[0].data!;
    if (!data.exclusionOwner)
      throw new ApplicationError(
        `Failure getRoomInfo. (Target roomInfo document has not exclusionOwner.)`,
        { roomNo }
      );
    if (data.exclusionOwner !== option.exclusionOwner)
      throw new ApplicationError(
        `Failure getRoomInfo. (Already touched.)`,
        { roomNo }
      );
  }

  // idチェック
  if (option.id !== undefined && option.id !== roomDocList[0].ref.id) {
    throw new ApplicationError(
      `Failure getRoomInfo. (Request id is not match stored id.)`,
      { roomNo, "storeId": roomDocList[0].ref.id, requestId: option.id }
    );
  }

  return roomDocList[0];
}

/**
 * コレクションから特定の情報を取得する
 * @param driver
 * @param collection
 * @param id
 * @param option
 */
export async function getData(
  driver: Driver,
  collection: string,
  id: string,
  option: GetDataOption<any> = {}
): Promise<DocumentSnapshot<StoreObj<any>> | null> {
  const collectionReference = option.collectionReference || driver.collection<StoreObj<any>>(collection);
  const docSnap = (await collectionReference.doc(id).get());

  if (!docSnap || !docSnap.exists()) return null;

  // 排他チェック
  if (option.exclusionOwner !== undefined) {
    const data = docSnap.data;
    if (!data.exclusionOwner)
      throw new ApplicationError(
        `Failure getData. (Target data document has not exclusionOwner.)`,
        { collection, id }
      );
    if (data.exclusionOwner !== option.exclusionOwner)
      throw new ApplicationError(
        `Failure getData. (Already touched.)`,
        { collection, id }
      );
  }
  return docSnap;
}

export async function checkViewer(driver: Driver, exclusionOwner: string): Promise<boolean> {
  const viewerInfo = (await getSocketDocSnap(driver, exclusionOwner)).data!;
  return !(viewerInfo && viewerInfo.roomId && viewerInfo.userId);
}

export async function additionalStatus(
  driver: Driver,
  roomCollectionPrefix: string,
  actorId: string
): Promise<string> {
  const statusCollectionName = `${roomCollectionPrefix}-DATA-status-list`;
  const statusResult = await getMaxOrder<ActorStatusStore>(driver, statusCollectionName);
  const statusCollection = statusResult.c;

  const statusDocRef = await statusCollection.add({
    ownerType: "actor",
    owner: actorId,
    order: statusResult.maxOrder + 1,
    exclusionOwner: null,
    lastExclusionOwner: null,
    status: "added",
    createTime: new Date(),
    updateTime: null,
    data: {
      name: "◆",
      isSystem: true,
      standImageInfoId: null,
      chatPaletteInfoId: null
    },
    permission: PERMISSION_DEFAULT
  });

  await resistCollectionName(driver, statusCollectionName);

  return statusDocRef.id;
}

/**
 * リソースマスターが更新された後の処理
 * @param driver
 * @param socket
 * @param roomCollectionPrefix
 * @param docId
 * @param docData
 */
export async function updateResourceMaster(
  driver: Driver,
  socket: any,
  roomCollectionPrefix: string,
  docId: string,
  docData: ResourceMasterStore
) {
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

export async function deleteResourceMaster(
  driver: Driver,
  roomCollectionPrefix: string,
  id: string
): Promise<void> {
  const initiativeColumnCC = driver.collection<any>(`${roomCollectionPrefix}-DATA-initiative-column-list`);
  // 直列の非同期で全部実行する
  await procAsyncSplit(
    (await initiativeColumnCC.where("data.resourceMasterId", "==", id).get())
      .docs
      .map(doc => doc.ref.delete())
  );

  const resourceCC = driver.collection<any>(`${roomCollectionPrefix}-DATA-resource-list`);
  // 直列の非同期で全部実行する
  await procAsyncSplit(
    (await resourceCC.where("data.masterId", "==", id).get())
      .docs
      .map(doc => doc.ref.delete())
  );
}

export async function addResourceMaster(
  driver: Driver,
  socket: any,
  roomCollectionPrefix: string,
  owner: string | null,
  resourceMaster: ResourceMasterStore
): Promise<string> {
  // まずはリソース定義を追加
  const resourceMasterCCName = `${roomCollectionPrefix}-DATA-resource-master-list`;
  const resourceMasterResult = await getMaxOrder<ResourceMasterStore>(driver, resourceMasterCCName);
  const resourceMasterCC = resourceMasterResult.c;

  const resourceMasterDocRef = await resourceMasterCC.add({
    ownerType: "user",
    owner,
    order: resourceMasterResult.maxOrder + 1,
    exclusionOwner: null,
    lastExclusionOwner: null,
    status: "added",
    createTime: new Date(),
    updateTime: null,
    data: resourceMaster,
    permission: PERMISSION_DEFAULT
  });

  // 自動付与（アクター）なら、リソース連携
  if (resourceMaster.isAutoAddActor) {
    // アクター一覧を取得
    const actorCCName = `${roomCollectionPrefix}-DATA-actor-list`;
    const actorCC = driver.collection<StoreObj<ActorStore>>(actorCCName);
    const idList = (await actorCC.get()).docs.map(doc => doc.ref.id);

    // リソースインスタンスを追加
    await addDirect(driver, socket, {
      collection: `${roomCollectionPrefix}-DATA-resource-list`,
      dataList: idList.map(() => ({
        masterId: resourceMasterDocRef.id,
        type: resourceMaster.type,
        value: resourceMaster.defaultValue
      })),
      optionList: idList.map(id => ({
        ownerType: "actor",
        owner: id,
        order: -1
      }))
    }, false);
  }

  // 自動付与（コマ）なら、リソース連携
  if (resourceMaster.isAutoAddMapObject) {
    // アクター一覧を取得
    const sceneObjectCCName = `${roomCollectionPrefix}-DATA-scene-object-list`;
    const sceneObjectCC = driver.collection<StoreObj<any>>(sceneObjectCCName);
    const idList = (await sceneObjectCC.get()).docs.map(doc => doc.ref.id);

    // リソースインスタンスを追加
    await addDirect(driver, socket, {
      collection: `${roomCollectionPrefix}-DATA-resource-list`,
      dataList: idList.map(() => ({
        masterId: resourceMasterDocRef.id,
        type: resourceMaster.type,
        value: resourceMaster.defaultValue
      })),
      optionList: idList.map(id => ({
        ownerType: "scene-object",
        owner: id,
        order: -1
      }))
    }, false);
  }

  if (resourceMaster.isAutoAddActor || resourceMaster.isAutoAddMapObject) {
    // イニシアティブカラムインスタンスを追加
    await addDirect(driver, socket, {
      collection: `${roomCollectionPrefix}-DATA-initiative-column-list`,
      dataList: [{
        resourceMasterId: resourceMasterDocRef.id
      }],
      optionList: [{
        ownerType: null,
        owner: null
      }]
    }, false);
  }

  return resourceMasterDocRef.id;
}

export async function addScene(
  driver: Driver,
  socket: any,
  roomCollectionPrefix: string,
  docRef: DocumentReference<any>
) {
  // シーンレイヤーの追加
  const sceneLayerListCCName = `${roomCollectionPrefix}-DATA-scene-layer-list`;
  const sceneLayerListCC = driver.collection<any>(sceneLayerListCCName);
  // 現存する各シーンすべてに今回登録したシーンオブジェクトを紐づかせる
  const sceneAndLayerList = (await sceneLayerListCC.get()).docs.map(doc => ({
    sceneId: docRef.id,
    layerId: doc.ref.id,
    isUse: true
  }));
  await addDirect(driver, socket, {
    collection: `${roomCollectionPrefix}-DATA-scene-and-layer-list`,
    dataList: sceneAndLayerList
  }, false);

  // シーンオブジェクトの追加
  const sceneObjectListCCName = `${roomCollectionPrefix}-DATA-scene-object-list`;
  const sceneObjectListCC = driver.collection<any>(sceneObjectListCCName);
  // 現存する各シーンすべてに今回登録したシーンオブジェクトを紐づかせる
  const sceneAndObjectList = (await sceneObjectListCC.get()).docs.map(doc => ({
    sceneId: docRef.id,
    objectId: doc.ref.id,
    isOriginalAddress: false,
    originalAddress: null,
    entering: "normal"
  }));
  await addDirect(driver, socket, {
    collection: `${roomCollectionPrefix}-DATA-scene-and-object-list`,
    dataList: sceneAndObjectList
  }, false);
}

export async function addSceneLayer(
  driver: Driver,
  socket: any,
  roomCollectionPrefix: string,
  docRef: DocumentReference<any>
) {
  // シーンオブジェクトの追加
  const sceneListCCName = `${roomCollectionPrefix}-DATA-scene-list`;
  const sceneListCC = driver.collection<any>(sceneListCCName);
  // 現存する各シーンすべてに今回登録したシーンオブジェクトを紐づかせる
  const sceneAndLayerList = (await sceneListCC.get()).docs.map(doc => ({
    sceneId: doc.ref.id,
    layerId: docRef.id,
    isUse: true
  }));
  await addDirect(driver, socket, {
    collection: `${roomCollectionPrefix}-DATA-scene-and-layer-list`,
    dataList: sceneAndLayerList
  }, false);
}

export async function addSceneObject(
  driver: Driver,
  socket: any,
  roomCollectionPrefix: string,
  owner: string | null,
  docRef: DocumentReference<any>,
  addInfo: StoreObj<any>
) {
  // シーンオブジェクトの追加
  const sceneListCCName = `${roomCollectionPrefix}-DATA-scene-list`;
  const sceneListCC = driver.collection<any>(sceneListCCName);
  // 現存する各シーンすべてに今回登録したシーンオブジェクトを紐づかせる
  const sceneAndObjectList = (await sceneListCC.get()).docs.map(doc => ({
    sceneId: doc.ref.id,
    objectId: docRef.id,
    isOriginalAddress: false,
    originalAddress: null,
    entering: "normal"
  }));
  await addDirect(driver, socket, {
    collection: `${roomCollectionPrefix}-DATA-scene-and-object-list`,
    dataList: sceneAndObjectList
  }, false);

  if (addInfo.data.type === "character") {
    // キャラクターコマの追加

    // アクターの追加の場合
    if (!addInfo.data.actorId) {
      // 併せてActorの登録も行う
      const actorId: string = await addActor(driver, socket, roomCollectionPrefix, owner, {
        name: addInfo.data.name,
        type: "character",
        chatFontColorType: "owner",
        chatFontColor: "#000000",
        standImagePosition: 1,
        pieceIdList: [docRef.id]
      });

      // ActorIdをキャラクターコマに登録
      addInfo.data.actorId = actorId;
      await docRef.update(addInfo);

      // キャラクターをActorグループに登録
      const addActorGroupFix = (addActorGroup as Function).bind(
        null,
        driver,
        roomCollectionPrefix,
        actorId,
        "other",
        owner
      );
      await addActorGroupFix("All");
    } else {
      // 既存Actorにコマを追加するパターン
      const actorDocSnap = await getData(
        driver,
        `${roomCollectionPrefix}-DATA-actor-list`,
        addInfo.data.actorId,
        {}
      );
      if (actorDocSnap && actorDocSnap.exists()) {
        (actorDocSnap.data.data.pieceIdList as string[]).push(docRef.id);
        await actorDocSnap.ref.update(actorDocSnap.data);
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
        owner: docRef.id,
        order: -1
      }))
    }, false);
  }
}

export async function addActor(
  driver: Driver,
  socket: any,
  roomCollectionPrefix: string,
  owner: string | null,
  actorInfoPartial: Partial<ActorStore>
): Promise<string> {
  const actorCollectionName = `${roomCollectionPrefix}-DATA-actor-list`;
  const actorResult = await getMaxOrder<ActorStore>(driver, actorCollectionName);
  const actorCollection = actorResult.c;

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

  const actorDocRef = await actorCollection.add({
    ownerType: "user",
    owner,
    order: actorResult.maxOrder + 1,
    exclusionOwner: null,
    lastExclusionOwner: null,
    status: "added",
    createTime: new Date(),
    updateTime: null,
    data: actorInfo,
    permission: PERMISSION_OWNER_CHANGE
  });

  const actorId = actorDocRef.id;

  actorInfoPartial.statusId = (await addDirect(driver, socket, {
    collection: `${roomCollectionPrefix}-DATA-status-list`,
    dataList: [
      {
        name: "◆",
        isSystem: true,
        standImageInfoId: null,
        chatPaletteInfoId: null
      }
    ],
    optionList: [{
      ownerType: "actor",
      owner: actorId
    }]
  }, false))[0];

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

  await actorDocRef.update({
    status: "modified",
    data: actorInfo,
    updateTime: new Date()
  });

  // リソースの自動追加
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

  await resistCollectionName(driver, actorCollectionName);

  return actorId;
}

export async function addActorGroup(
  driver: Driver,
  roomCollectionPrefix: string,
  id: string,
  type: "user" | "other",
  userId: string | null,
  groupName: string
): Promise<void> {
  const actorGroupCollectionName = `${roomCollectionPrefix}-DATA-actor-group-list`;
  const actorGroupCollection = driver.collection<StoreObj<ActorGroup>>(actorGroupCollectionName);

  const groupDoc = (await actorGroupCollection.where("data.name", "==", groupName).get()).docs[0];
  const data: ActorGroup = groupDoc.data!.data!;
  data.list.push({
    id,
    type,
    userId
  });
  await groupDoc.ref.update({
    data
  });
}

export async function addUser(
  driver: Driver,
  socket: any,
  exclusionOwner: string,
  roomCollectionPrefix: string,
  name: string,
  password: string,
  type: UserType
): Promise<UserLoginResponse> {
  const roomUserCollectionName = `${roomCollectionPrefix}-DATA-user-list`;
  const userCollection = driver.collection<StoreObj<UserStore>>(roomUserCollectionName);

  const socketDocSnap = (await getSocketDocSnap(driver, exclusionOwner));

  password = await hash(password, hashAlgorithm);

  const token = uuid.v4();

  const userDocRef = await userCollection.add({
    ownerType: null,
    owner: null,
    order: -1,
    exclusionOwner: null,
    lastExclusionOwner: null,
    status: "added",
    createTime: new Date(),
    updateTime: null,
    data: {
      name,
      password,
      token,
      type,
      login: 1
    },
    permission: PERMISSION_DEFAULT
  });

  const userId = userDocRef.id;

  await socketDocSnap.ref.update({
    userId
  });

  const actorId: string = await addActor(driver, socket, roomCollectionPrefix, userId, {
    name: name,
    type: "user",
    chatFontColorType: "original",
    chatFontColor: "#000000",
    standImagePosition: 1
  });

  const addActorGroupFix = (addActorGroup as Function).bind(
    null,
    driver,
    roomCollectionPrefix,
    actorId,
    "user",
    userId
  );
  await addActorGroupFix("All");
  await addActorGroupFix("Users");
  if (type === "PL") await addActorGroupFix("Players");
  if (type === "GM") await addActorGroupFix("GameMasters");
  if (type === "VISITOR") await addActorGroupFix("Visitors");

  await resistCollectionName(driver, roomUserCollectionName);

  return {
    userId,
    token
  };
}

export async function addTouchier(
  driver: Driver,
  socketId: string,
  collection: string,
  id: string,
  updateTime: Date | null
): Promise<void> {
  const c = driver.collection<TouchierStore>(SYSTEM_COLLECTION.TOUCH_LIST);
  const doc: DocumentChange<TouchierStore> = (await c
    .where("socketId", "==", socketId)
    .where("collection", "==", collection)
    .where("id", "==", id)
    .get()).docs[0];
  if (doc) {
    // あり得ないけど一応存在チェック
    throw new SystemError(`Touchier is Exist. collection: ${collection}, id: ${id}, socketId: ${socketId}`);
  }
  await c.add({
    socketId,
    collection,
    docId: id,
    time: new Date(),
    backupUpdateTime: updateTime
  });
}

export async function deleteTouchier(
  driver: Driver,
  socketId: string,
  collection?: string,
  id?: string
): Promise<Date | null> {
  const c = driver.collection<TouchierStore>(SYSTEM_COLLECTION.TOUCH_LIST);
  let q: Query<TouchierStore> = c.where("socketId", "==", socketId);
  if (collection !== undefined)
    q = q.where("collection", "==", collection);
  if (id !== undefined)
    q = q.where("docId", "==", id);
  const docList: DocumentChange<TouchierStore>[] = (await q.get()).docs;
  if (!docList || !docList.length) {
    console.warn(`deleteTouchier失敗 socket: ${socketId}, collection: ${collection}, id: ${id}`);
    return null;
  }

  const backupUpdateTime = docList[0].data ? docList[0].data.backupUpdateTime : null;

  const deleteList = async (doc: DocumentSnapshot<TouchierStore>): Promise<void> => {
    await doc.ref.delete();
  };
  await docList
    .map((doc: DocumentSnapshot<TouchierStore>) => () => deleteList(doc))
    .reduce((prev, curr) => prev.then(curr), Promise.resolve());

  return backupUpdateTime;
}

export async function releaseTouch(
  driver: Driver,
  socketId: string,
  collection?: string,
  id?: string
): Promise<void> {
  const c = driver.collection<TouchierStore>(SYSTEM_COLLECTION.TOUCH_LIST);
  let q: Query<TouchierStore> = c.where("socketId", "==", socketId);
  if (collection !== undefined)
    q = q.where("collection", "==", collection);
  if (id !== undefined)
    q = q.where("id", "==", id);
  const docList: DocumentChange<TouchierStore>[] = (await q.get()).docs;
  if (!docList || !docList.length) return;
  docList.forEach(async doc => {
    if (doc.exists()) {
      const { collection, docId } = doc.data;
      const targetCollection = driver.collection<StoreObj<any>>(collection);
      const target = await targetCollection.doc(docId).get();
      if (target.exists()) {
        if (target.data.data) {
          await target.ref.update({
            exclusionOwner: null
          });
        } else {
          await target.ref.delete();
        }
      }
    }
    await doc.ref.delete();
  });
}

export async function getSocketDocSnap(driver: Driver, socketId: string): Promise<DocumentSnapshot<SocketStore>> {
  const socketDocSnap = (await driver.collection<SocketStore>(SYSTEM_COLLECTION.SOCKET_LIST)
    .where("socketId", "==", socketId)
    .get())
    .docs
    .filter(doc => doc && doc.exists())[0];

  // No such socket check.
  if (!socketDocSnap) throw new ApplicationError(`No such socket.`, { socketId });

  return socketDocSnap;
}

export async function getMaxOrder<T>(driver: Driver, collectionName: string): Promise<{ c: CollectionReference<StoreObj<T>>, maxOrder: number }> {
  const c = driver.collection<StoreObj<T>>(collectionName);

  const docs = (await c
    .orderBy("order", "desc")
    .get())
    .docs
    .filter(doc => doc && doc.exists());

  const maxOrder = !docs.length ? -1 : docs[0].data!.order;

  return {
    c, maxOrder
  }
}

export async function getOwner(driver: Driver, socketId: string, owner: string | null | undefined): Promise<string | null> {
  if (owner !== undefined) return owner;
  const socketDocSnap = (await getSocketDocSnap(driver, socketId));
  const userId = socketDocSnap.data!.userId;

  // No such user check.
  if (!userId) throw new ApplicationError(`No such user.`, { socketId });

  return userId;
}

function arrayChunk(list: any[], size = 1) {
  // 最初の要素は１つだけ
  return list.reduce((acc, _value, index) => index % size ? acc : [...acc, list.slice(index, index + size)], []);
}

/**
 * 並列に実行したい非同期処理を６つずつまとめて実行する
 * @param promiseList
 */
export async function procAsyncSplit(promiseList: Promise<void>[]) {
  const totalStart = process.hrtime();
  await arrayChunk(promiseList, 6)
    .map((list: Promise<void>[]) => async () => {
      const start = process.hrtime();
      await Promise.all(list);
      const end = process.hrtime(start);
      console.info('  time (hr): %dms', end[1] / 1000000);
    })
    .reduce((prev: Promise<void>, curr: () => Promise<void>) => prev.then(curr), Promise.resolve());
  const totalEnd = process.hrtime(totalStart);
  console.info('Total time (hr): %dms', totalEnd[1] / 1000000);
}
