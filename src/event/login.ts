import {Resister} from "../server";
import {SystemError} from "../error/SystemError";
import {verify} from "../password";
import {setEvent, getRoomInfo, removeRoomViewer} from "./common";
import Driver from "nekostore/lib/Driver";
import DocumentSnapshot from "nekostore/lib/DocumentSnapshot";
import {LoginResponse, RoomStore} from "../@types/room";
import {StoreObj} from "../@types/store";
import {ApplicationError} from "../error/ApplicationError";
import {log} from "util";

// インタフェース
const eventName = "login";
type RequestType = { id: string; roomNo: number; password: string };
type ResponseType = LoginResponse | null;

/**
 * ログイン処理
 * @param driver
 * @param exclusionOwner
 * @param arg
 */
async function login(driver: Driver, exclusionOwner: string, arg: RequestType): Promise<ResponseType> {
  const roomInfoSnapshot: DocumentSnapshot<StoreObj<RoomStore>> = await getRoomInfo(driver, arg.roomNo);

  // 部屋存在チェック
  if (!roomInfoSnapshot || !roomInfoSnapshot.data || !roomInfoSnapshot.data.data || roomInfoSnapshot.ref.id !== arg.id)
    throw new ApplicationError(`No such room error. room-no=${arg.roomNo}`);

  try {
    if (await verify(roomInfoSnapshot.data.data.password, arg.password, "bcrypt")) {
      // パスワードチェックOK
      delete roomInfoSnapshot.data.data.password;
      removeRoomViewer(driver, exclusionOwner);
      return roomInfoSnapshot.data.data;
    } else {
      // パスワードチェックで引っかかった
      return null;
    }
  } catch (err) {
    throw new SystemError(`Login verify fatal error. room-no=${arg.roomNo}`);
  }
}

const resist: Resister = (driver: Driver, socket: any): void => {
  setEvent<RequestType, ResponseType>(driver, socket, eventName, (driver: Driver, arg: RequestType) => login(driver, socket.id, arg));
};
export default resist;
