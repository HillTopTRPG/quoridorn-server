import BasicDriver from "nekostore/lib/driver/basic";
import SocketDriverServer from "nekostore/lib/driver/socket/SocketDriverServer";
import fs from "fs";
import YAML from "yaml";
import {ServerSetting} from "./@types/server";
import * as path from "path";
import resistGetRoomListEvent from "./event/get-room-list";
import resistTouchRoomEvent from "./event/touch-room";
import resistCreateRoomEvent from "./event/create-room";
import resistLoginEvent from "./event/login";
import Driver from "nekostore/lib/Driver";
import Store from "nekostore/src/store/Store";
import MongoStore from "nekostore/lib/store/MongoStore";
import MemoryStore from "nekostore/lib/store/MemoryStore";
const co = require('co');

export type Resister = (d: Driver, socket: any) => void;
export const serverSetting: ServerSetting = YAML.parse(fs.readFileSync(path.resolve(__dirname, "../conf/server.yaml"), "utf8"));

/**
 * データストアにおいてサーバプログラムが直接参照するコレクションテーブルの名前
 */
export namespace SYSTEM_COLLECTION {
  /** 部屋一覧 */
  export const ROOM_LIST = "quoridorn-room-list";
  /** 部屋に関するシークレットコレクション */
  export const ROOM_SECRET= `room-secret-collection-${serverSetting.secretCollectionSuffix}`;
}

async function getStore(setting: ServerSetting): Promise<Store> {
  return new Promise((resolve, reject) => {
    if (setting.storeType === "mongodb") {
      co(function* () {
        const MongoClient = require('mongodb').MongoClient;
        const client = yield MongoClient.connect(setting.mongodbConnectionStrings, { useNewUrlParser: true, useUnifiedTopology: true });
        const db = client.db("quoridorn");
        resolve(new MongoStore({ db }));
      }).catch(err => {
        console.log(err.stack);
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

    const io = require('socket.io').listen(serverSetting.port);

    // 🐧ハート💖ビート🕺
    io.set("heartbeat interval", 5000);
    io.set("heartbeat timeout", 15000);

    console.log("Quoridorn Server is Ready.");

    io.on("connection", (socket: any) => {
      console.log("Connected", socket.id);

      // nekostore起動！
      new SocketDriverServer(driver, socket);

      socket.on('disconnect', () => {
        console.log('disconnected', socket.id);
      });
      socket.on('error', () => {
        console.log('error', socket.id);
      });

      // socket.ioの各リクエストに対する処理の登録
      [
        // 部屋情報一覧取得リクエスト
        resistGetRoomListEvent,
        // 部屋作成着手リクエスト
        resistTouchRoomEvent,
        // 部屋作成リクエスト
        resistCreateRoomEvent,
        // ログインリクエスト
        resistLoginEvent
      ].forEach((r: Resister) => r(driver, socket));
    });
  } catch (err) {
    console.error("MongoDB connect fail.");
    console.error(err);
  }
}

main();
