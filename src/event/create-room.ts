import {StoreObj} from "../@types/store";
import {CreateRoomRequest, RoomStore, UserLoginRequest} from "../@types/room";
import {hashAlgorithm, Resister} from "../server";
import {hash} from "../password";
import uuid from "uuid";
import {getRoomInfo, removeRoomViewer, setEvent, userLogin} from "./common";
import Driver from "nekostore/lib/Driver";
import DocumentSnapshot from "nekostore/lib/DocumentSnapshot";
import {ApplicationError} from "../error/ApplicationError";

// インタフェース
const eventName = "create-room";
type RequestType = CreateRoomRequest;
type ResponseType = string;

/**
 * 部屋作成処理
 * @param driver
 * @param exclusionOwner
 * @param arg
 */
async function createRoom(driver: Driver, exclusionOwner: string, arg: RequestType): Promise<ResponseType> {
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

  // リクエスト情報の加工
  arg.roomPassword = await hash(arg.roomPassword, hashAlgorithm);
  delete arg.roomNo;

  const userInfo: UserLoginRequest = {
    roomId: arg.roomId,
    userName: arg.userName,
    userPassword: arg.userPassword,
    userType: arg.userType
  };

  delete arg.userName;
  delete arg.userPassword;
  delete arg.userType;

  const storeData: RoomStore = {
    ...arg,
    memberNum: 1,
    hasPassword: !!arg.roomPassword,
    roomCollectionSuffix: uuid.v4()
  };

  await roomInfoSnapshot.ref.update({
    exclusionOwner: null,
    data: storeData
  });

  // つくりたてほやほやの部屋にユーザを追加する
  await userLogin(driver, userInfo);

  await removeRoomViewer(driver, exclusionOwner);

  return storeData.roomCollectionSuffix;
}

const resist: Resister = (driver: Driver, socket: any): void => {
  setEvent<RequestType, ResponseType>(driver, socket, eventName, (driver: Driver, arg: RequestType) => createRoom(driver, socket.id, arg));
};
export default resist;
