import {StoreObj} from "../@types/store";
import {CreateRoomRequest, RoomStore} from "../@types/room";
import {Resister} from "../server";
import {hash} from "../password";
import uuid from "uuid";
import {getRoomInfo, removeRoomViewer, setEvent} from "./common";
import Driver from "nekostore/lib/Driver";
import DocumentSnapshot from "nekostore/lib/DocumentSnapshot";

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
    { exclusionOwner }
  );
  if (!roomInfoSnapshot) throw new Error(`No such room error. room-no=${arg.roomNo}`);

  // リクエスト情報の加工
  arg.password = await hash(arg.password, "bcrypt");
  delete arg.roomNo;

  const storeData: RoomStore = {
    ...arg,
    memberNum: 1,
    hasPassword: !!arg.password,
    roomCollectionSuffix: uuid.v4()
  };

  await roomInfoSnapshot.ref.update({
    exclusionOwner: null,
    data: storeData
  });

  removeRoomViewer(driver, exclusionOwner);

  return storeData.roomCollectionSuffix;
}

const resist: Resister = (driver: Driver, socket: any): void => {
  setEvent<RequestType, ResponseType>(driver, socket, eventName, (driver: Driver, arg: RequestType) => createRoom(driver, socket.id, arg));
};
export default resist;
