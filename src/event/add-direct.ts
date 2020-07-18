import {StoreObj} from "../@types/store";
import {PERMISSION_DEFAULT, Resister} from "../server";
import {
  addActor,
  addResourceMaster,
  addScene,
  addSceneLayer,
  addSceneObject,
  getMaxOrder,
  getOwner,
  notifyProgress,
  resistCollectionName,
  setEvent
} from "./common";
import Driver from "nekostore/lib/Driver";
import {ApplicationError} from "../error/ApplicationError";
import {AddDirectRequest} from "../@types/socket";
import DocumentReference from "nekostore/src/DocumentReference";

// インタフェース
const eventName = "add-direct";
type RequestType = AddDirectRequest;
type ResponseType = string[];

/**
 * データ作成処理
 * @param driver
 * @param socket
 * @param arg
 * @param sendNotify
 * @param nestNum
 * @param nestNumTotal
 */
export async function addDirect(
  driver: Driver,
  socket: any,
  arg: RequestType,
  sendNotify: boolean = true,
  nestNum: number = 0,
  nestNumTotal: number = 0
): Promise<ResponseType> {
  const exclusionOwner: string = socket.id;
  const { c, maxOrder } = await getMaxOrder<any>(driver, arg.collection);
  let startOrder = maxOrder + 1;

  const docIdList: string[] = [];

  const total = nestNumTotal || arg.dataList.length;

  const addFunc = async (data: any, idx: number): Promise<void> => {
    const option = arg.optionList && arg.optionList[idx];
    const owner = await getOwner(driver, exclusionOwner, option ? option.owner : undefined);

    // 進捗報告
    if (sendNotify) {
      const current = nestNum + idx;
      notifyProgress(socket, total, current);
    }

    const roomCollectionPrefix = arg.collection.replace(/-DATA-.+$/, "");
    const collectionName = arg.collection.replace(/^.+-DATA-/, "");

    if (collectionName === "actor-list") {
      docIdList.push(await addActor(driver, socket, roomCollectionPrefix, owner, data));
      return;
    }

    if (collectionName === "resource-master-list") {
      docIdList.push(await addResourceMaster(driver, socket, roomCollectionPrefix, owner, data));
      return;
    }

    // 追加する１件のデータ
    const addInfo: StoreObj<any> = {
      ownerType: option && option.ownerType !== undefined ? option.ownerType : "user",
      owner,
      order: option && option.order !== undefined ? option.order : startOrder++,
      exclusionOwner: null,
      lastExclusionOwner: null,
      status: "added",
      createTime: new Date(),
      updateTime: new Date(),
      permission: option && option.permission || PERMISSION_DEFAULT,
      data
    };

    // DBに追加
    let docRef: DocumentReference<any>;
    try {
      docRef = await c.add(addInfo);
      docIdList.push(docRef.id);
    } catch (err) {
      throw new ApplicationError(`Failure add doc.`, addInfo);
    }

    // 追加のデータ操作
    if (collectionName === "scene-list") {
      // シーンオブジェクトの追加
      await addScene(driver, socket, roomCollectionPrefix, docRef);
    }
    if (collectionName === "scene-object-list") {
      // シーンオブジェクトの追加
      await addSceneObject(driver, socket, roomCollectionPrefix, owner, docRef, addInfo);
    }
    if (collectionName === "scene-layer-list") {
      // シーンレイヤーの追加
      await addSceneLayer(driver, socket, roomCollectionPrefix, docRef);
    }
  };

  // collectionの記録
  await resistCollectionName(driver, arg.collection);

  // 直列の非同期で全部実行する
  await arg.dataList
    .map((data: any, idx: number) => () => addFunc(data, idx))
    .reduce((prev, curr) => prev.then(curr), Promise.resolve());

  // 進捗報告
  if (!sendNotify) notifyProgress(socket, total, nestNum + arg.dataList.length);

  return docIdList;
}

const resist: Resister = (driver: Driver, socket: any): void => {
  setEvent<RequestType, ResponseType>(driver, socket, eventName, (driver: Driver, arg: RequestType) => addDirect(driver, socket, arg));
};
export default resist;
