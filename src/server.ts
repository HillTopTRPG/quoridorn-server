import BasicDriver from "nekostore/lib/driver/basic";
import SocketDriverServer from "nekostore/lib/driver/socket/SocketDriverServer";
import fs from "fs";
import YAML from "yaml";
import {ServerSetting} from "./@types/server";
import * as path from "path";
import resistGetVersionEvent from "./event/get-version";
import resistGetRoomListEvent from "./event/get-room-list";
import resistLoginEvent from "./event/login";
import resistTouchRoomEvent from "./event/touch-room";
import resistTouchRoomModifyEvent from "./event/touch-room-modify";
import resistReleaseTouchRoomEvent from "./event/release-touch-room";
import resistCreateRoomEvent from "./event/create-room";
import resistDeleteRoomEvent from "./event/delete-room";
import resistTouchDataEvent from "./event/touch-data";
import resistTouchDataModifyEvent from "./event/touch-data-modify";
import resistReleaseTouchDataEvent from "./event/release-touch-data";
import resistCreateDataEvent from "./event/create-data";
import resistDeleteDataEvent from "./event/delete-data";
import Driver from "nekostore/lib/Driver";
import Store from "nekostore/src/store/Store";
import MongoStore from "nekostore/lib/store/MongoStore";
import MemoryStore from "nekostore/lib/store/MemoryStore";
import {releaseTouch} from "./event/common";
import {HashAlgorithmType} from "./password";
const co = require("co");
import { Db } from "mongodb";
import {StoreObj} from "./@types/store";
import {RoomStore, SocketStore, UseStore} from "./@types/socket";
import {ApplicationError} from "./error/ApplicationError";

export type Resister = (d: Driver, socket: any) => void;
export const serverSetting: ServerSetting = YAML.parse(fs.readFileSync(path.resolve(__dirname, "../config/server.yaml"), "utf8"));

export const hashAlgorithm: HashAlgorithmType = "bcrypt";
export const version: string = "Quoridorn 1.0.0a15";

/**
 * データストアにおいてサーバプログラムが直接参照するコレクションテーブルの名前
 */
export namespace SYSTEM_COLLECTION {
  /** 部屋一覧 */
  export const ROOM_LIST = `rooms-${serverSetting.secretCollectionSuffix}`;
  /** 部屋一覧情報を受信するsocket.idの一覧 */
  export const ROOM_VIEWER_LIST = `room-viewer-list-${serverSetting.secretCollectionSuffix}`;
  /** ユーザ一覧 */
  export const USER_LIST = `users-${serverSetting.secretCollectionSuffix}`;
  /** タッチしているsocket.idの一覧 */
  export const TOUCH_LIST = `touch-list-${serverSetting.secretCollectionSuffix}`;
  /** 接続中のsocket.idの一覧 */
  export const SOCKET_LIST = `socket-list-${serverSetting.secretCollectionSuffix}`;
}

async function getStore(setting: ServerSetting): Promise<{store: Store, db?: Db}> {
  return new Promise((resolve, reject) => {
    if (setting.storeType === "mongodb") {
      co(function* () {
        const MongoClient = require("mongodb").MongoClient;
        const client = yield MongoClient.connect(setting.mongodbConnectionStrings, { useNewUrlParser: true, useUnifiedTopology: true });
        const db = client.db("quoridorn");
        resolve({ store: new MongoStore({ db }), db });
      }).catch(err => {
        console.error(err.stack);
        reject(err);
      });
    } else {
      resolve({ store: new MemoryStore() });
    }
  });
}

async function addSocketList(driver: Driver, socketId: string) {
  await driver.collection<SocketStore>(SYSTEM_COLLECTION.SOCKET_LIST).add({
    socketId,
    roomId: null,
    userId: null,
    connectTime: new Date()
  });
}

async function logout(driver: Driver, socketId: string) {
  (await driver.collection<SocketStore>(SYSTEM_COLLECTION.SOCKET_LIST)
    .where("socketId", "==", socketId)
    .get()).docs
    .filter(doc => doc && doc.exists())
    .forEach(async doc => {
      const socketData: SocketStore = doc.data;
      if (socketData.roomId && socketData.userId) {
        // ログアウト処理
        const userDocSnap = await driver.collection<StoreObj<UseStore>>(SYSTEM_COLLECTION.USER_LIST)
        .doc(socketData.userId)
        .get();
        if (!userDocSnap || !userDocSnap.exists())
          throw new ApplicationError(`No such user. user-id=${socketData.userId}`);
        const userData = userDocSnap.data.data;
        userData.login--;
        userDocSnap.ref.update({
          data: userData
        });

        if (userData.login === 0) {
          const roomDocSnap = await driver.collection<StoreObj<RoomStore>>(SYSTEM_COLLECTION.ROOM_LIST)
          .doc(socketData.roomId)
          .get();
          if (!roomDocSnap || !roomDocSnap.exists())
            throw new ApplicationError(`No such room. room-id=${socketData.roomId}`);
          const roomData = roomDocSnap.data.data;
          roomData.memberNum--;
          roomDocSnap.ref.update({
            data: roomData
          });
        }
      }
      doc.ref.delete();
    });
}

async function main(): Promise<void> {
  try {
    const { store, db } = await getStore(serverSetting);
    const driver = new BasicDriver({ store });

    const io = require("socket.io").listen(serverSetting.port);

    // 🐧ハート💖ビート🕺
    io.set("heartbeat interval", 5000);
    io.set("heartbeat timeout", 15000);

    console.log("Quoridorn Server is Ready.");

    io.on("connection", async (socket: any) => {
      console.log("Connected", socket.id);

      // 接続情報に追加
      addSocketList(driver, socket.id);

      // nekostore起動！
      new SocketDriverServer(driver, socket);

      socket.on("disconnect", async () => {
        console.log("disconnected", socket.id);
        try {
          // 切断したらその人が行なっていたすべてのタッチを解除
          await releaseTouch(driver, socket.id);

          // 接続情報にから削除
          await logout(driver, socket.id);
        } catch (err) {
          console.error(err);
        }
      });
      socket.on("error", () => {
        console.log("error", socket.id);
      });

      // socket.ioの各リクエストに対する処理の登録
      [
        // バージョン番号取得処理
        resistGetVersionEvent,
        // 部屋情報一覧取得リクエスト
        resistGetRoomListEvent,
        // ログインリクエスト
        resistLoginEvent,
        // 部屋（作成）着手リクエスト
        resistTouchRoomEvent,
        // 部屋（編集・削除）着手リクエスト
        resistTouchRoomModifyEvent,
        // 部屋（作成・削除・編集）キャンセル処理
        resistReleaseTouchRoomEvent,
        // 部屋作成リクエスト
        resistCreateRoomEvent,
        // 部屋削除リクエスト
        resistDeleteRoomEvent,
        // データ（作成）着手リクエスト
        resistTouchDataEvent,
        // データ（編集・削除）着手リクエスト
        resistTouchDataModifyEvent,
        // データ（作成・削除・編集）キャンセル処理
        resistReleaseTouchDataEvent,
        // データ作成リクエスト
        resistCreateDataEvent,
        // データ削除リクエスト
        resistDeleteDataEvent
      ].forEach((r: Resister) => r(driver, socket));
    });

    // setInterval(() => {
    //   db.listCollections().toArray(function(err: any, collectionInfoList: any[]) {
    //     console.log("=== All Collections START ===");
    //     if (err) {
    //       console.warn(err);
    //       return;
    //     }
    //     const collectionNameList = collectionInfoList
    //       .filter(collectionInfo => collectionInfo.type === "collection")
    //       .map(collectionInfo => collectionInfo.name);
    //
    //     console.log("=== All Collections END ===");
    //   });
    // }, 1000 * 60 * 5);

  } catch (err) {
    console.error("MongoDB connect fail.");
    console.error(err);
  }
}

main();
