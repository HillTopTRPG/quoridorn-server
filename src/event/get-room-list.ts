import {
  ClientRoomInfo,
  GetRoomListResponse,
  RoomViewResponse
} from "../@types/socket";
import {getMessage, Resister, serverSetting, SYSTEM_COLLECTION, targetClient} from "../server";
import Driver from "nekostore/lib/Driver";
import {ChangeType} from "nekostore/lib/DocumentChange";
import Unsubscribe from "nekostore/src/Unsubscribe";
import {compareVersion} from "../utility/GitHub";
import {RoomStore} from "../@types/data";
import {checkViewer} from "../utility/collection";
import {setEvent} from "../utility/server";


// インタフェース
const eventName = "get-room-list";
type RequestType = string;
type ResponseType = GetRoomListResponse;

/**
 * 部屋情報一覧（サーバ設定の部屋数の数の長さの配列）を返却する
 */
async function getRoomList(driver: Driver, socket: any, arg: RequestType): Promise<ResponseType> {
  try {
    const clientVersion = arg;
    let usable: boolean = false;
    if (targetClient.from) {
      if (targetClient.to) {
        usable =
          compareVersion(targetClient.from, clientVersion) <= 0 &&
          compareVersion(targetClient.to, clientVersion) > 0;
      } else {
        usable =
          compareVersion(targetClient.from, clientVersion) <= 0;
      }
    }

    let roomList: (StoreData<ClientRoomInfo> & { id: string; })[] | null = null;

    if (usable) {
      const c = driver.collection<StoreData<RoomStore>>(SYSTEM_COLLECTION.ROOM_LIST);
      roomList = (await c.orderBy("order").get()).docs
        .filter(doc => doc.exists())
        .map(doc => {
          if (doc.data && doc.data.data) {
            delete doc.data.data.roomPassword;
            delete doc.data.data.roomCollectionPrefix;
          }
          return {
            ...doc.data!,
            id: doc.ref.id
          };
        });

      // コレクションに変更があるたびに、「result-room-view」イベントをクライアントに送信する
      let unsubscribe: Unsubscribe | null = await c.onSnapshot(async snapshot => {
        try {
          if (!unsubscribe) return;
          if (await checkViewer(driver, socket.id)) {
            const changeList: RoomViewResponse[] = snapshot.docs.map(change => {
              const changeType: ChangeType = change.type;
              const data: StoreData<RoomStore> | undefined = change.data;
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
              await unsubscribe();
              unsubscribe = null;
            }
          }
        } catch (err) {
          if (unsubscribe) {
            // snapshotの解除
            await unsubscribe();
            unsubscribe = null;
          }
          console.error(err);
          socket.emit("result-room-view", err, null);
        }
      });

      // サーバ設定部屋数の数だけ要素のある配列に整えていく
      for (let i = 0; i < serverSetting.roomNum; i++) {
        if (roomList[i] && roomList[i].order === i) continue;
        roomList.splice(i, 0, {
          id: "",
          collection: "rooms",
          key: "",
          ownerType: null,
          owner: null,
          order: i,
          exclusionOwner: null,
          lastExclusionOwner: null,
          permission: null,
          status: null,
          createTime: new Date(),
          updateTime: null,
          refList: []
        });
      }
    }
    return {
      roomList,
      message: getMessage(),
      isNeedRoomCreatePassword: !!serverSetting.roomCreatePassword
    };
  } catch (err) {
    throw err;
  }
}

const resist: Resister = (driver: Driver, socket: any): void => {
  setEvent<RequestType, ResponseType>(driver, socket, eventName, (driver: Driver, arg: RequestType) => getRoomList(driver, socket, arg));
};
export default resist;
