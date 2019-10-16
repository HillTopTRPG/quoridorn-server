import {StoreObj} from "../@types/store";
import {RoomInfo} from "../@types/room";
import {Resister, SYSTEM_COLLECTION} from "../server";
import {RoomPrivateCollection} from "../@types/server";
import {SystemError} from "../error/SystemError";
import {verify} from "../password";
import {setEvent, getStoreObj} from "./common";
import Driver from "nekostore/lib/Driver";

// インタフェース
const eventName = "login";
type RequestType = { id: string; no: number; password: string };
type ResponseType = string | null;

/**
 * ログイン処理
 * @param driver
 * @param arg
 */
async function login(driver: Driver, arg: RequestType): Promise<ResponseType> {
  const docList = (await driver.collection<StoreObj<RoomInfo>>(SYSTEM_COLLECTION.ROOM_LIST)
    .where("order", "==", arg.no)
    .get()).docs;
  const roomInfo = docList.length ? getStoreObj<RoomInfo>(docList[0]) : null;

  // 部屋存在チェック
  if (!roomInfo || !roomInfo.data || roomInfo.id !== arg.id)
    throw new Error(`No such room error. room-no=${arg.no}`);

  const roomSecretCollection = await driver.collection<RoomPrivateCollection>(SYSTEM_COLLECTION.ROOM_SECRET);
  const roomSecretDoc = (await roomSecretCollection.where("roomId", "==", arg.id).get()).docs;

  // 部屋一覧に部屋情報はあるのに、シークレット部屋情報が存在しない場合
  // → サーバ管理者が手動でレコードを消した以外にはあり得ない
  // ※ 前段の部屋存在チェックにて、新規部屋作成前のtouch-room状態ではないことは確認済み
  if (!roomSecretDoc.length)
    throw new SystemError(`No such room secret info. Please report to server administrator. room-no=${arg.no}, room-id=${arg.id}`);

  // シークレット部屋情報が複数件取得できてしまった場合
  // 仕様上考慮しなくていいとされてきたuuidが重複してしまった本当の想定外エラー
  if (roomSecretDoc.length > 1)
    throw new SystemError(`Duplicate room secret info. Please report to server administrator. room-no=${arg.no}, room-id=${arg.id}`);

  try {
    if (await verify(roomSecretDoc[0].data.password, arg.password, "bcrypt")) {
      // パスワードチェックOK
      // 部屋データコレクションの接尾子を返却する
      return roomSecretDoc[0].data.roomCollectionSuffix;
    } else {
      // パスワードチェックで引っかかった
      return null;
    }
  } catch (err) {
    throw new SystemError(`Login verify fatal error. room-no=${arg.no}`);
  }
}

const resist: Resister = (driver: Driver, socket: any): void => {
  setEvent<RequestType, ResponseType>(driver, socket, eventName, login);
};
export default resist;
