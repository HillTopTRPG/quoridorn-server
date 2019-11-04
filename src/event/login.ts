import {hashAlgorithm, Resister} from "../server";
import {SystemError} from "../error/SystemError";
import {verify} from "../password";
import {setEvent, getRoomInfo, userLogin} from "./common";
import Driver from "nekostore/lib/Driver";
import DocumentSnapshot from "nekostore/lib/DocumentSnapshot";
import {LoginRequest, LoginResponse, RoomStore, UserLoginRequest} from "../@types/socket";
import {StoreObj} from "../@types/store";
import {ApplicationError} from "../error/ApplicationError";
import {releaseTouchRoom} from "./release-touch-room";

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
  // タッチ解除
  await releaseTouchRoom(driver, exclusionOwner, {
    roomNo: arg.roomNo
  }, true);

  // 部屋一覧の更新
  const docSnap: DocumentSnapshot<StoreObj<RoomStore>> = await getRoomInfo(
    driver,
    arg.roomNo,
    { id: arg.roomId }
  );

  if (!docSnap)
    throw new ApplicationError(`Untouched room error. room-no=${arg.roomNo}`);

  if (!docSnap.data.data)
    throw new ApplicationError(`Until created room error. room-no=${arg.roomNo}`);

  // 部屋パスワードチェック
  try {
    if (await verify(docSnap.data.data.roomPassword, arg.roomPassword, hashAlgorithm)) {
      // パスワードチェックOK
      delete docSnap.data.data.roomPassword;
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
  if (!await userLogin(driver, exclusionOwner, userLoginInfo)) {
    // ログイン失敗
    return null;
  }

  return docSnap.data.data;
}

const resist: Resister = (driver: Driver, socket: any): void => {
  setEvent<RequestType, ResponseType>(driver, socket, eventName, (driver: Driver, arg: RequestType) => login(driver, socket.id, arg));
};
export default resist;
