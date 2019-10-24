import {hashAlgorithm, Resister} from "../server";
import {SystemError} from "../error/SystemError";
import {verify} from "../password";
import {setEvent, getRoomInfo, removeRoomViewer, userLogin} from "./common";
import Driver from "nekostore/lib/Driver";
import DocumentSnapshot from "nekostore/lib/DocumentSnapshot";
import {LoginRequest, LoginResponse, RoomStore, UserLoginRequest} from "../@types/room";
import {StoreObj} from "../@types/store";
import {ApplicationError} from "../error/ApplicationError";

// インタフェース
const eventName = "login";
type RequestType = LoginRequest;
type ResponseType = LoginResponse | null;

/**
 * ログイン処理
 * @param driver
 * @param exclusionOwner
 * @param arg
 */
async function login(driver: Driver, exclusionOwner: string, arg: RequestType): Promise<ResponseType> {
  // 部屋一覧の更新
  const roomInfoSnapshot: DocumentSnapshot<StoreObj<RoomStore>> = await getRoomInfo(
    driver,
    arg.roomNo,
    { exclusionOwner, id: arg.roomId }
  );
  if (!roomInfoSnapshot) throw new ApplicationError(`Untouched room error. room-no=${arg.roomNo}`);

  const data = roomInfoSnapshot.data;
  if (data.data)
    throw new ApplicationError(`Already created room error. room-no=${arg.roomNo}`);

  // 部屋パスワードチェック
  try {
    if (await verify(roomInfoSnapshot.data.data.roomPassword, arg.roomPassword, hashAlgorithm)) {
      // パスワードチェックOK
      delete roomInfoSnapshot.data.data.roomPassword;
    } else {
      // パスワードチェックで引っかかった
      return null;
    }
  } catch (err) {
    throw new SystemError(`Login verify fatal error. room-no=${arg.roomNo}`);
  }

  // ユーザログイン処理
  const userLoginInfo: UserLoginRequest = {
    roomId: arg.roomId,
    userName: arg.userName,
    userType: arg.userType,
    userPassword: arg.userPassword
  };
  if (!await userLogin(driver, userLoginInfo)) {
    // ログイン失敗
    return null;
  }

  await removeRoomViewer(driver, exclusionOwner);
  return roomInfoSnapshot.data.data;
}

const resist: Resister = (driver: Driver, socket: any): void => {
  setEvent<RequestType, ResponseType>(driver, socket, eventName, (driver: Driver, arg: RequestType) => login(driver, socket.id, arg));
};
export default resist;
