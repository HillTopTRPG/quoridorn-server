import {StoreObj} from "../@types/store";
import {DeleteRoomRequest} from "../@types/socket";
import {hashAlgorithm, Resister} from "../server";
import {verify} from "../utility/password";
import {getRoomInfo, setEvent} from "./common";
import Driver from "nekostore/lib/Driver";
import DocumentSnapshot from "nekostore/lib/DocumentSnapshot";
import {ApplicationError} from "../error/ApplicationError";
import {SystemError} from "../error/SystemError";
import {releaseTouchRoom} from "./release-touch-room";
import { Db } from "mongodb";
import {RoomStore} from "../@types/data";

// インタフェース
const eventName = "delete-room";
type RequestType = DeleteRoomRequest;
type ResponseType = boolean;

/**
 * 部屋削除処理
 * @param driver
 * @param exclusionOwner
 * @param arg
 * @param db
 */
async function deleteRoom(driver: Driver, exclusionOwner: string, arg: RequestType, db?: Db): Promise<ResponseType> {
  // タッチ解除
  await releaseTouchRoom(driver, exclusionOwner, {
    roomNo: arg.roomNo
  }, true);

  // 部屋一覧の更新
  const docSnap: DocumentSnapshot<StoreObj<RoomStore>> | null = await getRoomInfo(
    driver,
    arg.roomNo,
    { id: arg.roomId }
  );

  // Untouched check.
  if (!docSnap || !docSnap.exists()) throw new ApplicationError(`Untouched room.`, arg);

  // Already check.
  const data = docSnap.data.data;
  if (!data) throw new ApplicationError(`Already deleted.`, arg);

  // 部屋パスワードチェック
  try {
    if (!await verify(docSnap.data.data!.roomPassword, arg.roomPassword, hashAlgorithm)) {
      // パスワードチェックで引っかかった
      return false;
    }
  } catch (err) {
    throw new SystemError(`Login verify fatal error. room-no=${arg.roomNo}`);
  }

  try {
    await docSnap.ref.delete();
  } catch (err) {
    throw new ApplicationError(`Failure delete doc.`, arg);
  }

  if (db) {
    const deleteCollection = (suffix: string) => {
      db.collection(`${data.roomCollectionPrefix}-DATA-${suffix}`).drop(() => {
        // args: err, delOK
        // nothing.
      });
    };

    const roomCollectionPrefix = data.roomCollectionPrefix;

    // メディアコレクションからメディアストレージの削除
    const mediaCCName = `${roomCollectionPrefix}-DATA-media-list`;
    const mediaCC = driver.collection<StoreObj<{ url: string }>>(mediaCCName);
    (await mediaCC.get()).docs.map(d => d.data!.data!.url).forEach(url => {
      deleteCollection(url);
    });

    // 部屋のコレクションの削除
    const collectionNameCollectionName = `${roomCollectionPrefix}-DATA-collection-list`;
    const cnCC = driver.collection<{ name: string }>(collectionNameCollectionName);
    (await cnCC.get()).docs.map(d => d.data!.name).forEach(name => {
      deleteCollection(name);
    });
    deleteCollection(collectionNameCollectionName);

    // TODO Storageも削除する
  }

  return true;
}

const resist: Resister = (driver: Driver, socket: any, _io: any, db?: Db): void => {
  setEvent<RequestType, ResponseType>(driver, socket, eventName, (driver: Driver, arg: RequestType) => deleteRoom(driver, socket.id, arg, db));
};
export default resist;
