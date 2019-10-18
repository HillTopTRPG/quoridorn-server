import {StoreMetaData, StoreObj} from "../@types/store";
import {RoomInfo} from "../@types/room";
import {Resister, serverSetting, SYSTEM_COLLECTION} from "../server";
import {setEvent, getStoreObj} from "./common";
import Driver from "nekostore/lib/Driver";

// インタフェース
const eventName = "get-room-list";
type RequestType = never;
type ResponseType = (StoreObj<RoomInfo> & StoreMetaData)[];

/**
 * 部屋情報一覧（サーバ設定の部屋数の数の長さの配列）を返却する
 */
async function getRoomList(driver: Driver): Promise<ResponseType> {
  try {
    const c = driver.collection<StoreObj<RoomInfo>>(SYSTEM_COLLECTION.ROOM_LIST);
    const infoList: ResponseType = (await c.orderBy("order").get()).docs
    .filter(doc => doc.exists())
    .map(doc => getStoreObj(doc));

    console.log(infoList);

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

const resist: Resister = (driver: Driver, socket: any): void => {
  setEvent<RequestType, ResponseType>(driver, socket, eventName, getRoomList);
};
export default resist;
