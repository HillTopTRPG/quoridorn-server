import {StoreObj} from "../@types/store";
import {PERMISSION_DEFAULT, Resister} from "../server";
import {
  addActor,
  addActorGroup,
  getData,
  getMaxOrder,
  getOwner,
  notifyProgress,
  registCollectionName,
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
 * @param isNest
 */
async function addDirect(driver: Driver, socket: any, arg: RequestType, isNest: boolean = false): Promise<ResponseType> {
  const exclusionOwner: string = socket.id;
  const { c, maxOrder } = await getMaxOrder<any>(driver, arg.collection);
  let startOrder = maxOrder + 1;

  const docIdList: string[] = [];

  const addFunc = async (data: any, current: number): Promise<void> => {
    const option = arg.optionList && arg.optionList[current];
    const owner = await getOwner(driver, exclusionOwner, option && option.owner || undefined);

    // 進捗報告
    if (!isNest) notifyProgress(socket, arg.dataList.length, current);

    // 追加する１件のデータ
    const addInfo: StoreObj<any> = {
      ownerType: option ? option.ownerType || null : "user",
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
    let docId: string;
    try {
      docRef = await c.add(addInfo);
      docId = docRef.id;
      docIdList.push(docId);
    } catch (err) {
      throw new ApplicationError(`Failure add doc.`, addInfo);
    }

    const roomCollectionPrefix = arg.collection.replace(/-DATA-.+$/, "");
    const collectionName = arg.collection.replace(/^.+-DATA-/, "");

    if (collectionName === "scene-object-list") {
      // シーンオブジェクトの追加
      const sceneListCCName = `${roomCollectionPrefix}-DATA-scene-list`;
      const sceneListCC = driver.collection<any>(sceneListCCName);
      // 現存する各シーンすべてに今回登録したシーンオブジェクトを紐づかせる
      const sceneAndObjectList = (await sceneListCC.get()).docs.map(doc => ({
        sceneId: doc.ref.id,
        objectId: docId,
        isOriginalAddress: false,
        originalAddress: null,
        entering: "normal"
      }));
      await addDirect(driver, socket, {
        collection: "scene-and-object-list",
        dataList: sceneAndObjectList
      }, true);

      if (data.type === "character") {
        // キャラクターコマの追加
        if (!data.actorId) {
          // 併せてActorの登録も行う
          const actorId: string = await addActor(driver, roomCollectionPrefix, owner, {
            name: data.name,
            type: "character",
            chatFontColorType: "owner",
            chatFontColor: "#000000",
            standImagePosition: 1,
            isUseTableData: true,
            pieceIdList: [docId]
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
            data.actorId,
            {}
          );
          if (actorDocSnap && actorDocSnap.exists()) {
            (actorDocSnap.data.data.pieceIdList as string[]).push(docId);
            await actorDocSnap.ref.update(actorDocSnap.data);
          }
        }
      }
    }
  };

  // collectionの記録
  await registCollectionName(driver, arg.collection);

  // 直列の非同期で全部実行する
  await arg.dataList
    .map((data: any, idx: number) => () => addFunc(data, idx))
    .reduce((prev, curr) => prev.then(curr), Promise.resolve());

  // 進捗報告
  if (!isNest) notifyProgress(socket, arg.dataList.length, arg.dataList.length);

  return docIdList;
}

const resist: Resister = (driver: Driver, socket: any): void => {
  setEvent<RequestType, ResponseType>(driver, socket, eventName, (driver: Driver, arg: RequestType) => addDirect(driver, socket, arg));
};
export default resist;
