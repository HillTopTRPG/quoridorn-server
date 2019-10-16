import {StoreObj} from "../@types/store";
import {RoomInfo} from "../@types/room";
import {Resister, SYSTEM_COLLECTION} from "../server";
import {ApplicationError} from "../error/ApplicationError";
import {RoomPrivateCollection} from "../@types/server";
import {hash} from "../password";
import uuid from "uuid";
import {setEvent} from "./common";
import Driver from "nekostore/lib/Driver";

// インタフェース
const eventName = "create-room";
type RequestType = { no: number; password: string; roomInfo: RoomInfo };
type ResponseType = string;

/**
 * 部屋作成処理
 * @param driver
 * @param exclusionOwner
 * @param arg
 */
async function createRoom(driver: Driver, exclusionOwner: string, arg: RequestType): Promise<ResponseType> {
  // 部屋一覧の更新
  const docList = (await driver.collection<StoreObj<RoomInfo>>(SYSTEM_COLLECTION.ROOM_LIST)
    .where("order", "==", arg.no)
    .get()).docs;
  if (!docList.length) throw new Error(`No such room error. room-no=${arg.no}`);

  const doc = docList[0];
  const data = doc.data;

  // 排他チェック
  if (!data.exclusionOwner) throw new ApplicationError(`Illegal operation. room-no=${arg.no}`);
  if (data.exclusionOwner !== exclusionOwner) throw new ApplicationError(`Other player touched. room-no=${arg.no}`);

  arg.roomInfo.hasPassword = !!arg.password;

  await doc.ref.update({
    exclusionOwner: null,
    data: arg.roomInfo
  });

  // シークレットコレクションへの書き込み
  const roomSecretCollection = await driver.collection<RoomPrivateCollection>(SYSTEM_COLLECTION.ROOM_SECRET);

  // パスワードのハッシュ化
  const hashedPassword = await hash(arg.password, "bcrypt");
  // 部屋データコレクションの名前の接尾子を生成
  const roomCollectionSuffix = uuid.v4();

  roomSecretCollection.add({
    roomId: doc.ref.id,
    password: hashedPassword,
    roomCollectionSuffix
  });
  return roomCollectionSuffix;
}

const resist: Resister = (driver: Driver, socket: any): void => {
  setEvent<RequestType, ResponseType>(driver, socket, eventName, (driver: Driver, arg: RequestType) => createRoom(driver, socket.id, arg));
};
export default resist;
