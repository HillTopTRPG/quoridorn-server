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
import {RoomStore, UserStore} from "../@types/data";

// インタフェース
const eventName = "delete-room";
type RequestType = DeleteRoomRequest;
type ResponseType = boolean;

const suffixList = [
  "screen-list",
  "map-layer-list",
  "map-and-layer-list",
  "room-data",
  "image-list",
  "image-tag-list",
  "cut-in-list",
  "$userId-play-list",
  "play-list",
  "user-list",
  "property-list",
  "property-selection-list",
  "property-face-list",
  "character-list",
  "extra-list",
  "dice-symbol-list",
  "floor-tile-list",
  "chit-list",
  "map-mask-list",
  "tag-note-list",
  "actor-group-list"
];

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

    const roomUserCollectionName = `${data.roomCollectionPrefix}-DATA-user-list`;
    const userCollection = driver.collection<StoreObj<UserStore>>(roomUserCollectionName);
    suffixList.forEach(async s => {
      if (s.startsWith("$userId-")) {
        const docs = (await userCollection.get()).docs;
        docs.forEach(async doc => {
          if (!doc || !doc.exists()) return;
          const userId = doc.ref.id;
          deleteCollection(s.replace("$userId", userId));
        });
      } else {
        deleteCollection(s);
      }
    });
  }

  return true;
}

const resist: Resister = (driver: Driver, socket: any, db?: Db): void => {
  setEvent<RequestType, ResponseType>(driver, socket, eventName, (driver: Driver, arg: RequestType) => deleteRoom(driver, socket.id, arg, db));
};
export default resist;
