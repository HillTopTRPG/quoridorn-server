import BasicDriver from "nekostore/lib/driver/basic";
import SocketDriverServer from "nekostore/lib/driver/socket/SocketDriverServer";
import fs from "fs";
import YAML from "yaml";
import {ServerSetting} from "./@types/server";
import * as path from "path";
import resistGetRoomListEvent from "./event/get-room-list";
import resistTouchRoomEvent from "./event/touch-room";
import resistTouchRoomModifyEvent from "./event/touch-room-modify";
import resistReleaseTouchRoomEvent from "./event/release-touch-room";
import resistCreateRoomEvent from "./event/create-room";
import resistDeleteRoomEvent from "./event/delete-room";
import resistLoginEvent from "./event/login";
import resistGetVersionEvent from "./event/get-version";
import Driver from "nekostore/lib/Driver";
import Store from "nekostore/src/store/Store";
import MongoStore from "nekostore/lib/store/MongoStore";
import MemoryStore from "nekostore/lib/store/MemoryStore";
import {deleteTouchier, removeRoomViewer} from "./event/common";
import {HashAlgorithmType} from "./password";
const co = require("co");

export type Resister = (d: Driver, socket: any) => void;
export const serverSetting: ServerSetting = YAML.parse(fs.readFileSync(path.resolve(__dirname, "../config/server.yaml"), "utf8"));

export const hashAlgorithm: HashAlgorithmType = "bcrypt";
export const version: string = "Quoridorn 1.0.0a10";

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
}


async function getStore(setting: ServerSetting): Promise<Store> {
  return new Promise((resolve, reject) => {
    if (setting.storeType === "mongodb") {
      co(function* () {
        const MongoClient = require("mongodb").MongoClient;
        const client = yield MongoClient.connect(setting.mongodbConnectionStrings, { useNewUrlParser: true, useUnifiedTopology: true });
        const db = client.db("quoridorn");
        resolve(new MongoStore({ db }));
      }).catch(err => {
        console.error(err.stack);
        reject(err);
      });
    } else {
      resolve(new MemoryStore());
    }
  });
}

async function main(): Promise<void> {
  try {
    const store = await getStore(serverSetting);
    const driver = new BasicDriver({ store });

    const io = require("socket.io").listen(serverSetting.port);

    // 🐧ハート💖ビート🕺
    io.set("heartbeat interval", 5000);
    io.set("heartbeat timeout", 15000);

    console.log("Quoridorn Server is Ready.");

    io.on("connection", (socket: any) => {
      console.log("Connected", socket.id);

      // nekostore起動！
      new SocketDriverServer(driver, socket);

      socket.on("disconnect", async () => {
        console.log("disconnected", socket.id);
        await removeRoomViewer(driver, socket.id);
        await deleteTouchier(driver, socket.id);
      });
      socket.on("error", () => {
        console.log("error", socket.id);
      });

      // socket.ioの各リクエストに対する処理の登録
      [
        // 部屋情報一覧取得リクエスト
        resistGetRoomListEvent,
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
        // ログインリクエスト
        resistLoginEvent,
        // バージョン番号取得処理
        resistGetVersionEvent
      ].forEach((r: Resister) => r(driver, socket));
    });

    // 5分おきに...
    // TODO systemCollectionTouchTimeoutの処理
    // setInterval(async () => {
    //   const roomDocList = (await driver.collection<StoreObj<RoomInfo>>(SYSTEM_COLLECTION.ROOM_LIST)
    //     .where("data", "==", null)
    //     .get()).docs;
    //
    // }, 1000 * 60 * 5);
  } catch (err) {
    console.error("MongoDB connect fail.");
    console.error(err);
  }
}

main();
