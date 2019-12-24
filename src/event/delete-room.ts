import {StoreObj} from "../@types/store";
import {DeleteRoomRequest, RoomStore, UserStore} from "../@types/socket";
import {hashAlgorithm, Resister} from "../server";
import {verify} from "../utility/password";
import {getRoomInfo, setEvent} from "./common";
import Driver from "nekostore/lib/Driver";
import DocumentSnapshot from "nekostore/lib/DocumentSnapshot";
import {ApplicationError} from "../error/ApplicationError";
import {SystemError} from "../error/SystemError";
import {releaseTouchRoom} from "./release-touch-room";
import { Db } from "mongodb";

// インタフェース
const eventName = "delete-room";
type RequestType = DeleteRoomRequest;
type ResponseType = boolean;

const suffixList = [
  "map-list",
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
  "tag-note-list"
];

/**
 * 部屋削除処理
 * @param driver
 * @param exclusionOwner
 * @param arg
 * @param db
 */
async function deleteRoom(driver: Driver, exclusionOwner: string, arg: RequestType, db?: Db): Promise<ResponseType> {
  console.log(`START [deleteRoom (${exclusionOwner})] no=${arg.roomNo}, id=${arg.roomId}`);

  // タッチ解除
  try {
    await releaseTouchRoom(driver, exclusionOwner, {
      roomNo: arg.roomNo
    }, true);
  } catch (err) {
    console.log(`ERROR [deleteRoom (${exclusionOwner})] no=${arg.roomNo}, id=${arg.roomId}`);
    throw err;
  }

  // 部屋一覧の更新
  let docSnap: DocumentSnapshot<StoreObj<RoomStore>>;
  try {
    docSnap = await getRoomInfo(
      driver,
      arg.roomNo,
      { id: arg.roomId }
    );
  } catch (err) {
    console.log(`ERROR [deleteRoom (${exclusionOwner})] no=${arg.roomNo}, id=${arg.roomId}`);
    throw err;
  }

  if (!docSnap || !docSnap.exists()) {
    console.log(`ERROR [deleteRoom (${exclusionOwner})] no=${arg.roomNo}, id=${arg.roomId}`);
    throw new ApplicationError(`Untouched room error. room-no=${arg.roomNo}`);
  }

  const data = docSnap.data.data;
  if (!data) {
    console.log(`ERROR [deleteRoom (${exclusionOwner})] no=${arg.roomNo}, id=${arg.roomId}`);
    throw new ApplicationError(`Already deleted room error. room-no=${arg.roomNo}`);
  }

  // 部屋パスワードチェック
  try {
    if (!await verify(docSnap.data.data.roomPassword, arg.roomPassword, hashAlgorithm)) {
      // パスワードチェックで引っかかった
      console.log(`END (PASSWORD ERROR) [deleteRoom (${exclusionOwner})] no=${arg.roomNo}, id=${arg.roomId}`);
      return false;
    }
  } catch (err) {
    console.log(`ERROR [deleteRoom (${exclusionOwner})] no=${arg.roomNo}, id=${arg.roomId}`);
    throw new SystemError(`Login verify fatal error. room-no=${arg.roomNo}`);
  }

  const roomId = docSnap.ref.id;
  try {
    await docSnap.ref.delete();
  } catch (err) {
    console.log(`ERROR [deleteRoom (${exclusionOwner})] no=${arg.roomNo}, id=${arg.roomId}`);
    throw err;
  }

  // // 部屋に紐づくユーザの削除
  // const roomUserCollectionName = `${data.roomCollectionPrefix}-DATA-user-list`;
  // const userCollection = driver.collection<StoreObj<UserStore>>(roomUserCollectionName);
  // const docs = (await userCollection.where("data.roomId", "==", roomId).get()).docs;
  // docs.forEach(async doc => {
  //   if (!doc || !doc.exists()) return;
  //   try {
  //     await doc.ref.delete();
  //   } catch (err) {
  //     console.log(`ERROR [deleteRoom (${exclusionOwner})] no=${arg.roomNo}, id=${arg.roomId}`);
  //     throw err;
  //   }
  // });

  if (db) {
    const deleteCollection = (suffix: string) => {
      db.collection(`${data.roomCollectionPrefix}-DATA-${suffix}`).drop((err, delOK) => {
        // nothing.
      });
    };
    // TODO 各部屋情報コレクションの削除
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

  console.log(`END [deleteRoom (${exclusionOwner})] no=${arg.roomNo}, id=${arg.roomId}`);
  return true;
}

const resist: Resister = (driver: Driver, socket: any, db: Db): void => {
  setEvent<RequestType, ResponseType>(driver, socket, eventName, (driver: Driver, arg: RequestType) => deleteRoom(driver, socket.id, arg, db));
};
export default resist;
