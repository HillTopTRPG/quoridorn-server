import {StoreObj} from "../@types/store";
import {RoomInfo} from "../@types/room";
import {Resister, SYSTEM_COLLECTION} from "../server";
import {RoomSecretInfo} from "../@types/server";
import {hash} from "../password";
import uuid from "uuid";
import {getRoomInfo, setEvent} from "./common";
import Driver from "nekostore/lib/Driver";
import DocumentSnapshot from "nekostore/lib/DocumentSnapshot";

// インタフェース
const eventName = "create-room";
type RequestType = { roomNo: number; password: string; roomInfo: RoomInfo };
type ResponseType = string;

/**
 * 部屋作成処理
 * @param driver
 * @param exclusionOwner
 * @param arg
 */
async function createRoom(driver: Driver, exclusionOwner: string, arg: RequestType): Promise<ResponseType> {
  // 部屋一覧の更新
  const roomInfoSnapshot: DocumentSnapshot<StoreObj<RoomInfo>> = await getRoomInfo(
    driver,
    arg.roomNo,
    { exclusionOwner }
  );
  if (!roomInfoSnapshot) throw new Error(`No such room error. room-no=${arg.roomNo}`);

  arg.roomInfo.hasPassword = !!arg.password;

  await roomInfoSnapshot.ref.update({
    exclusionOwner: null,
    data: arg.roomInfo
  });

  // シークレットコレクションへの書き込み
  const roomSecretCollection = await driver.collection<RoomSecretInfo>(SYSTEM_COLLECTION.ROOM_SECRET);

  // パスワードのハッシュ化
  const hashedPassword = await hash(arg.password, "bcrypt");
  // 部屋データコレクションの名前の接尾子を生成
  const roomCollectionSuffix = uuid.v4();

  roomSecretCollection.add({
    roomId: roomInfoSnapshot.ref.id,
    password: hashedPassword,
    roomCollectionSuffix
  });
  return roomCollectionSuffix;
}

const resist: Resister = (driver: Driver, socket: any): void => {
  setEvent<RequestType, ResponseType>(driver, socket, eventName, (driver: Driver, arg: RequestType) => createRoom(driver, socket.id, arg));
};
export default resist;
