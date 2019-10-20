import {Resister} from "../server";
import {RoomSecretInfo} from "../@types/server";
import {SystemError} from "../error/SystemError";
import {verify} from "../password";
import {setEvent, getSecretRoomInfo, getRoomInfo} from "./common";
import Driver from "nekostore/lib/Driver";
import DocumentSnapshot from "nekostore/lib/DocumentSnapshot";
import {RoomInfo} from "../@types/room";
import {StoreObj} from "../@types/store";
import {ApplicationError} from "../error/ApplicationError";

// インタフェース
const eventName = "login";
type RequestType = { id: string; roomNo: number; password: string };
type ResponseType = string | null;

/**
 * ログイン処理
 * @param driver
 * @param arg
 */
async function login(driver: Driver, arg: RequestType): Promise<ResponseType> {
  const roomInfoSnapshot: DocumentSnapshot<StoreObj<RoomInfo>> = await getRoomInfo(driver, arg.roomNo);

  // 部屋存在チェック
  if (!roomInfoSnapshot || !roomInfoSnapshot.data || roomInfoSnapshot.ref.id !== arg.id)
    throw new ApplicationError(`No such room error. room-no=${arg.roomNo}`);

  const secretRoomInfo: RoomSecretInfo = await getSecretRoomInfo(driver, arg.roomNo, arg.id);

  try {
    if (await verify(secretRoomInfo.password, arg.password, "bcrypt")) {
      // パスワードチェックOK
      // 部屋データコレクションの接尾子を返却する
      return secretRoomInfo.roomCollectionSuffix;
    } else {
      // パスワードチェックで引っかかった
      return null;
    }
  } catch (err) {
    throw new SystemError(`Login verify fatal error. room-no=${arg.roomNo}`);
  }
}

const resist: Resister = (driver: Driver, socket: any): void => {
  setEvent<RequestType, ResponseType>(driver, socket, eventName, login);
};
export default resist;
