import {StoreMetaData, StoreObj} from "../@types/store";
import {GetRoomListResponse, RoomStore, RoomViewerStore, RoomViewResponse} from "../@types/room";
import {Resister, serverSetting, SYSTEM_COLLECTION} from "../server";
import {setEvent, getStoreObj} from "./common";
import Driver from "nekostore/lib/Driver";
import {ChangeType} from "nekostore/lib/DocumentChange";
import Unsubscribe from "nekostore/src/Unsubscribe";

// インタフェース
const eventName = "get-room-list";
type RequestType = never;
type ResponseType = (StoreObj<GetRoomListResponse> & StoreMetaData)[];

/**
 * 部屋情報一覧（サーバ設定の部屋数の数の長さの配列）を返却する
 */
async function getRoomList(driver: Driver, socket: any): Promise<ResponseType> {
  try {
    const c = driver.collection<StoreObj<RoomStore>>(SYSTEM_COLLECTION.ROOM_LIST);
    const infoList: ResponseType = (await c.orderBy("order").get()).docs
      .filter(doc => doc.exists())
      .map(doc => {
        const roomStore: StoreObj<RoomStore> & StoreMetaData = getStoreObj<RoomStore>(doc)!;
        if (roomStore.data) {
          delete roomStore.data.password;
          delete roomStore.data.roomCollectionSuffix;
        }
        return roomStore as StoreObj<GetRoomListResponse> & StoreMetaData;
      });

    // コレクションに変更があるたびに、「result-room-view」イベントをクライアントに送信し続ける
    if (!await checkViewer(driver, socket.id, true)) {
      let unsubscribe: Unsubscribe | null = await c.onSnapshot(async snapshot => {
        try {
          if (!unsubscribe) return;
          if (await checkViewer(driver, socket.id, false)) {
            const changeList: RoomViewResponse[] = snapshot.docs.map(change => {
              const changeType: ChangeType = change.type;
              const data: StoreObj<RoomStore> = change.data;
              const id: string = change.ref.id;
              const createTime: Date = change.createTime ? change.createTime.toDate() : null;
              const updateTime: Date = change.updateTime ? change.updateTime.toDate() : null;

              if (data && data.data) {
                delete data.data.password;
                delete data.data.roomCollectionSuffix;
              }
              return {
                changeType, data, id, createTime, updateTime
              }
            });
            socket.emit("result-room-view", null, changeList);
          } else {
            if (unsubscribe) {
              // snapshotの解除
              unsubscribe();
              unsubscribe = null;
            }
          }
        } catch (err) {
          if (unsubscribe) {
            // snapshotの解除
            unsubscribe();
            unsubscribe = null;
          }
          console.error(err);
          socket.emit("result-room-view", err, null);
        }
      });
    }

    // サーバ設定部屋数の数だけ要素のある配列に整えていく
    for (let i = 0; i < serverSetting.roomNum; i++) {
      if (infoList[i] && infoList[i].order === i) continue;
      infoList.splice(i, 0, {
        order: i,
        exclusionOwner: null,
        id: null,
        createTime: null,
        updateTime: null
      });
    }
    return infoList;
  } catch(err) {
    console.error(err);
    throw err;
  }
}

async function checkViewer(driver: Driver, exclusionOwner: string, isAdd: boolean): Promise<boolean> {
  const c = driver.collection<RoomViewerStore>(SYSTEM_COLLECTION.ROOM_VIEWER_LIST);
  const viewerInfo: RoomViewerStore | null = (await c
    .where("socketId", "==", exclusionOwner)
    .get()).docs
    .filter(doc => doc.exists())
    .map(doc => doc.data!)[0];

  if (isAdd && !viewerInfo) {
    // 初回かつ登録する場合
    c.add({
      socketId: exclusionOwner
    });
  }

  // 登録されていないかどうかを返却
  return !!viewerInfo;
}

const resist: Resister = (driver: Driver, socket: any): void => {
  setEvent<RequestType, ResponseType>(driver, socket, eventName, (driver: Driver) => getRoomList(driver, socket));
};
export default resist;
