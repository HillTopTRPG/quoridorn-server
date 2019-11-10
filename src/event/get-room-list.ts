import {StoreMetaData, StoreObj} from "../@types/store";
import {
  ClientRoomInfo,
  GetRoomListResponse,
  Message,
  RoomStore,
  RoomViewResponse
} from "../@types/socket";
import {Resister, serverSetting, SYSTEM_COLLECTION, version} from "../server";
import {setEvent, getStoreObj, checkViewer} from "./common";
import Driver from "nekostore/lib/Driver";
import {ChangeType} from "nekostore/lib/DocumentChange";
import Unsubscribe from "nekostore/src/Unsubscribe";
import fs from "fs";
import YAML from "yaml";
import * as path from "path";

export const message: Message = YAML.parse(fs.readFileSync(path.resolve(__dirname, "../../message/message.yaml"), "utf8"));
const termsOfUse: string = fs.readFileSync(path.resolve(__dirname, "../../message/termsOfUse.txt"), "utf8");
message.termsOfUse = termsOfUse.trim().replace(/(\r\n)/g, "\n");

// インタフェース
const eventName = "get-room-list";
type RequestType = never;
type ResponseType = GetRoomListResponse;

/**
 * 部屋情報一覧（サーバ設定の部屋数の数の長さの配列）を返却する
 */
async function getRoomList(driver: Driver, socket: any): Promise<ResponseType> {
  try {
    const c = driver.collection<StoreObj<RoomStore>>(SYSTEM_COLLECTION.ROOM_LIST);
    const infoList: (StoreObj<ClientRoomInfo> & StoreMetaData)[] = (await c.orderBy("order").get()).docs
      .filter(doc => doc.exists())
      .map(doc => {
        const roomStore: StoreObj<RoomStore> & StoreMetaData = getStoreObj<RoomStore>(doc)!;
        if (roomStore.data) {
          delete roomStore.data.roomPassword;
          delete roomStore.data.roomCollectionPrefix;
        }
        return roomStore as StoreObj<ClientRoomInfo> & StoreMetaData;
      });

    // コレクションに変更があるたびに、「result-room-view」イベントをクライアントに送信する
    let unsubscribe: Unsubscribe | null = await c.onSnapshot(async snapshot => {
      try {
        if (!unsubscribe) return;
        if (await checkViewer(driver, socket.id, false)) {
          const changeList: RoomViewResponse[] = snapshot.docs.map(change => {
            const changeType: ChangeType = change.type;
            const data: StoreObj<RoomStore> = change.data;
            const id: string = change.ref.id;

            if (data && data.data) {
              delete data.data.roomPassword;
              delete data.data.roomCollectionPrefix;
            }
            return {
              changeType, data, id
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
    return {
      roomList: infoList,
      message,
      version
    };
  } catch(err) {
    console.error(err);
    throw err;
  }
}

const resist: Resister = (driver: Driver, socket: any): void => {
  setEvent<RequestType, ResponseType>(driver, socket, eventName, (driver: Driver) => getRoomList(driver, socket));
};
export default resist;
