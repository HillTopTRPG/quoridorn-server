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

const driver = new BasicDriver();

const io = require('socket.io').listen(serverSetting.port);

// 🐧ハート💖ビート🕺
io.set("heartbeat interval", 5000);
io.set("heartbeat timeout", 15000);
io.on("connection", (socket: any) => {
  console.log("Connected", socket.id);

  // nekostore起動！
  new SocketDriverServer(driver, socket);

  socket.on('disconnect', () => {
    console.log('disconnected', socket.id);
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
