import BasicDriver from "nekostore/lib/driver/basic";
import SocketDriverServer from "nekostore/lib/driver/socket/SocketDriverServer";
import Driver from "nekostore/lib/Driver";
import Store from "nekostore/src/store/Store";
import MongoStore from "nekostore/lib/store/MongoStore";
import MemoryStore from "nekostore/lib/store/MemoryStore";
import * as YAML from "yaml";
import {Interoperability, ServerSetting, StorageSetting} from "./@types/server";
import * as path from "path";
import resistGetVersionEvent from "./event/get-version";
import resistGetRoomListEvent from "./event/get-room-list";
import resistRoomLoginEvent from "./event/room-login";
import resistUserLoginEvent from "./event/user-login";
import resistTouchRoomEvent from "./event/touch-room";
import resistTouchRoomModifyEvent from "./event/touch-room-modify";
import resistReleaseTouchRoomEvent from "./event/release-touch-room";
import resistCreateRoomEvent from "./event/create-room";
import resistDeleteRoomEvent from "./event/delete-room";
import resistTouchDataModifyEvent from "./event/touch-data-modify";
import resistReleaseTouchDataEvent from "./event/release-touch-data";
import resistUpdateDataEvent from "./event/update-data";
import resistUpdateDataPackageEvent from "./event/update-data-package";
import resistDeleteDataEvent from "./event/delete-data";
import resistSendDataEvent from "./event/send-data";
import resistAddDirectEvent from "./event/add-direct";
import resistUploadMediaEvent from "./event/upload-media";
import resistDeleteFileEvent from "./event/delete-file";
import resistAddRoomPresetDataEvent from "./event/add-room-preset-data";
import resistDeleteDataPackageEvent from "./event/delete-data-package";
import resistImportDataEvent from "./event/import-data";
import resistGetApi from "./rest-api/v1/get";
import resistMediaPost from "./rest-api/v1/media-post";
import resistDownloadRoom from "./rest-api/v1/download-room";
import resistUploadRoom from "./rest-api/v1/upload-room";
import resistRoomChatPostApi from "./rest-api/v1/room-chat-post";
import resistRoomDeleteApi from "./rest-api/v1/room-delete";
import resistRoomGetApi from "./rest-api/v1/room-get";
import resistRoomTokenGetApi from "./rest-api/v1/room-token-get";
import resistRoomUserGetApi from "./rest-api/v1/room-user-get";
import resistRoomUserTokenGetApi from "./rest-api/v1/room-user-token-get";
import resistRoomUsersGetApi from "./rest-api/v1/room-users-get";
import resistRoomsGetApi from "./rest-api/v1/rooms-get";
import resistTokenGetApi from "./rest-api/v1/token-get";
import {HashAlgorithmType} from "./utility/password";
import {Db, MongoClient} from "mongodb";
import {Message} from "./@types/socket";
import {ApplicationError} from "./error/ApplicationError";
import {SystemError} from "./error/SystemError";
import {compareVersion, getFileRow, TargetVersion} from "./utility/GitHub";
import {accessLog} from "./utility/logger";
import {RoomStore, SocketStore, TokenStore, TouchierStore} from "./@types/data";
import * as Minio from "minio";
import {releaseTouch} from "./utility/touch";
import {findList, findSingle, getSocketDocSnap} from "./utility/collection";
const cors = require('cors');
const express = require('express');
const bodyParser = require('body-parser');
import * as fs from "fs";

export const PERMISSION_DEFAULT: Permission = {
  view: { type: "none", list: [] },
  edit: { type: "none", list: [] },
  chmod: { type: "none", list: [] }
};

export const PERMISSION_OWNER: Permission = {
  view: { type: "allow", list: [{ type: "owner" }] },
  edit: { type: "allow", list: [{ type: "owner" }] },
  chmod: { type: "allow", list: [{ type: "owner" }] }
};

export type Resister = (d: Driver, socket: any, io: any, db?: Db) => void;
export type WebIfResister = (webApp: any, d: Driver, db: any) => void;
export const serverSetting: ServerSetting = YAML.parse(fs.readFileSync(path.resolve(__dirname, "../config/server.yaml"), "utf8"));
export const interoperability: Interoperability[] = YAML.parse(fs.readFileSync(path.resolve(__dirname, "./interoperability.yaml"), "utf8"));
export const targetClient: TargetVersion = {
  from: null,
  to: null
};

/***********************************************************************************************************************
 * サーバに設定されている利用規約やサーバ名などの情報をまとめて取得する
 */
export function getMessage(): Message {
  const termsOfUse: string = fs.readFileSync(path.resolve(__dirname, "../message/termsOfUse.txt"), "utf8");
  const message: Message = YAML.parse(fs.readFileSync(path.resolve(__dirname, "../message/message.yaml"), "utf8"));
  message.termsOfUse = termsOfUse.trim().replace(/(\r\n)/g, "\n");
  return message;
}

/***********************************************************************************************************************
 * ハッシュアルゴリズムの決定
 */
require('dotenv').config();
if (!process.env.npm_package_version) {
  throw new SystemError(`The version is not set in package.json.`);
}
export const version: string = `Quoridorn ${process.env.npm_package_version.replace("-", "")}`;
const hashAlgorithmStr: string = process.env.HASH_ALGORITHM as string;
if (hashAlgorithmStr !== "argon2" && hashAlgorithmStr !== "bcrypt") {
  throw new SystemError(`Unsupported hash algorithm(${hashAlgorithmStr}). Set .env to the hash algorithm "bcrypt".`);
}
// 今はbcryptしか対応してない
if (hashAlgorithmStr === "argon2") {
  throw new SystemError(`Unsupported hash algorithm(${hashAlgorithmStr}). Set .env to the hash algorithm "bcrypt".`);
}
export const hashAlgorithm: HashAlgorithmType = hashAlgorithmStr;

/***********************************************************************************************************************
 * s3設定
 */
const storageSetting: StorageSetting = YAML.parse(fs.readFileSync(path.resolve(__dirname, "../config/storage.yaml"), "utf8"));
const clientOption = {
  endPoint: storageSetting.endPoint,
  port: storageSetting.port,
  useSSL: storageSetting.useSSL,
  accessKey: storageSetting.accessKey,
  secretKey: storageSetting.secretKey
};
export const bucket = storageSetting.bucket;
export const accessUrl = storageSetting.accessUrl;

/***********************************************************************************************************************
 * s3サービスへの接続および疎通確認
 */
let _s3Client: Minio.Client | null = null;
try {
  _s3Client = new Minio.Client(clientOption);
  _s3Client!.putObject(bucket, "sample-test.txt", "sample-text").then(() => {
    console.log("S3 Storage upload-test success.");
    console.log(`S3 Storage connect success. (bucket: ${bucket})`);
  }).catch((err) => {
    console.error("S3 Storage upload-test failure.");
    console.error("Please review your settings. (src: config/storage.yaml)");
    console.error(JSON.stringify(clientOption, null, "  "));
    console.error(err);
    return;
  });
} catch (err) {
  console.error("S3 Storage connect failure. ");
  console.error("Please review your settings. (src: config/storage.yaml)");
  console.error(JSON.stringify(clientOption, null, "  "));
  console.error(err);
  throw err;
}
export const s3Client = _s3Client;

/***********************************************************************************************************************
 * データストアにおいてサーバプログラムが直接参照するコレクションテーブルの名前
 */
export namespace SYSTEM_COLLECTION {
  /** 部屋一覧 */
  export const ROOM_LIST = `rooms-${serverSetting.secretCollectionSuffix}`;
  /** タッチしているsocket.idの一覧 */
  export const TOUCH_LIST = `touch-list-${serverSetting.secretCollectionSuffix}`;
  /** 接続中のsocket.idの一覧 */
  export const SOCKET_LIST = `socket-list-${serverSetting.secretCollectionSuffix}`;
  /** WebAPIのトークンの一覧 */
  export const TOKEN_LIST = `token-list-${serverSetting.secretCollectionSuffix}`;
}

/***********************************************************************************************************************
 * DBをセットアップする
 */
async function getStore(setting: ServerSetting): Promise<{store: Store, db?: Db}> {
  if (setting.storeType === "mongodb") {
    const client = await MongoClient.connect(setting.mongodbConnectionStrings, { useNewUrlParser: true, useUnifiedTopology: true });
    const dbNameSuffix = interoperability[0].server.replace(/\./g, "-");
    const db = client.db(`quoridorn-${dbNameSuffix}`);
    return { store: new MongoStore({ db }), db };
  } else {
    return { store: new MemoryStore() };
  }
}

async function addSocketList(driver: Driver, socketId: string): Promise<void> {
  await driver.collection<SocketStore>(SYSTEM_COLLECTION.SOCKET_LIST).add({
    socketId,
    roomKey: null,
    roomNo: null,
    roomCollectionPrefix: null,
    storageId: null,
    userKey: null,
    connectTime: new Date()
  });
}

async function logout(driver: Driver, socketId: string): Promise<void> {
  const snap = (await getSocketDocSnap(driver, socketId));

  const socketData: SocketStore = snap.data!;
  if (socketData.roomKey && socketData.userKey) {
    const roomDoc = await findSingle<StoreData<RoomStore>>(
      driver,
      SYSTEM_COLLECTION.ROOM_LIST,
      "key",
      socketData.roomKey
    );
    if (!roomDoc || !roomDoc.exists())
      throw new ApplicationError(`No such room. room-key=${socketData.roomKey}`);
    const roomData = roomDoc.data.data!;

    // ログアウト処理
    const userDoc = await findSingle<StoreData<UserStore>>(
      driver,
      `${roomData.roomCollectionPrefix}-DATA-user-list`,
      "key",
      socketData.userKey
    );
    if (!userDoc || !userDoc.exists())
      throw new ApplicationError(`No such user. user-key=${socketData.userKey}`);
    const userData = userDoc.data.data!;
    userData.login--;
    await userDoc.ref.update({ data: userData });

    if (userData.login === 0) {
      roomData.memberNum--;
      await roomDoc.ref.update({ data: roomData });
    }

    const socketUserDoc = await findSingle<StoreData<SocketUserStore>>(
      driver,
      `${roomData.roomCollectionPrefix}-DATA-socket-user-list`,
      "data.socketId",
      socketId
    );

    if (!socketUserDoc)
      throw new ApplicationError(`No such user. user-key=${socketData.userKey}`);

    await socketUserDoc.ref.delete();
  }
  await snap.ref.delete();
}

async function getInteroperabilityInfo(): Promise<void> {
  let gitRow: string | null = null;
  try {
    gitRow = await getFileRow("quoridorn-server", "src/interoperability.yaml");
  } catch (err) {
    throw "Fetch to GitHub repository failed.";
  }
  const iList: Interoperability[] = YAML.parse(gitRow);
  if (compareVersion(iList[0].server, version) <= 0) {
    // サーバが最新系
    targetClient.from = iList[0].client;
  } else {
    // サーバは最新系ではない
    iList.forEach((i, index) => {
      if (!index) return;
      if (
        compareVersion(iList[index - 1].server, version) > 0 &&
        compareVersion(i.server, version) <= 0
      ) {
        targetClient.from = i.client;
        targetClient.to = iList[index - 1].client;
      }
    });
  }
}

async function main(): Promise<void> {
  try {
    await getInteroperabilityInfo();
  } catch (err) {
    console.error(err);
    return;
  }

  console.log("targetClient:", targetClient);

  try {
    const { store, db } = await getStore(serverSetting);
    const driver = new BasicDriver({ store });

    // DBを誰も接続してない状態にする
    await initDataBase(driver);

    const expressApp = express();
    expressApp.use(bodyParser.json({
      inflate: true,
      limit: '100kb',
      type: 'application/json',
      strict: true
    }));
    expressApp.use(cors({
      origin: true,
      credentials: true,
      methods: ["GET", "POST", "DELETE"],
      allowedHeaders: "authorization",
      exposedHeaders: ["Content-Disposition", "Content-Type"]
    }));
    // expressApp.use((_: Request, res: Response, next: NextFunction) => {
    //   res.header("Access-Control-Allow-Origin", "*");
    //   res.header("Access-Control-Allow-Headers", "Authorization");
    //   next();
    // });

    // const webApp = expressApp.listen(serverSetting.port);

    const http = require("http");
    const httpServer = http.createServer(expressApp);
    httpServer.listen(serverSetting.port);
    // const io = new Server();
    // io.listen(httpServer);

    const io = require("socket.io")(httpServer, {
      // transports: ["websocket", "polling"],
      cors: {
        origin: "*",
        // methods: ["GET", "POST"],
        // allowedHeaders: ["my-custom-header"],
        credentials: true
      }
    }
    );
    // io.listen();

    console.log(serverSetting.port);
    // httpServer.listen(serverSetting.port);

    // REST APIの各リクエストに対する処理の登録
    [
      resistGetApi,
      resistMediaPost,
      resistDownloadRoom,
      resistUploadRoom,
      resistRoomChatPostApi,
      resistRoomDeleteApi,
      resistRoomGetApi,
      resistRoomTokenGetApi,
      resistRoomUserGetApi,
      resistRoomUserTokenGetApi,
      resistRoomUsersGetApi,
      resistRoomsGetApi,
      resistTokenGetApi
    ].forEach((r: WebIfResister) => r(expressApp, driver, db));

    // server.listen(serverSetting.port);

    console.log(`Quoridorn Server is Ready. (version: ${process.env.npm_package_version})`);

    io.on("connection", async (socket: any) => {
      console.log("########");

      accessLog(socket.id, "CONNECTED");
      
      // 接続情報に追加
      await addSocketList(driver, socket.id);

      // nekostore起動！
      new SocketDriverServer(driver, socket);

      socket.on("disconnect", async () => {
        accessLog(socket.id, "DISCONNECTED");
        try {
          // 切断したらその人が行なっていたすべてのタッチを解除
          await releaseTouch(driver, socket.id);

          // 接続情報から削除
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
        // 部屋ログインリクエスト
        resistRoomLoginEvent,
        // ユーザログインリクエスト
        resistUserLoginEvent,
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
        // データ（編集・削除）着手リクエスト
        resistTouchDataModifyEvent,
        // データ（作成・削除・編集）キャンセル処理
        resistReleaseTouchDataEvent,
        // データ更新リクエスト
        resistUpdateDataEvent,
        // データ更新リクエスト
        resistUpdateDataPackageEvent,
        // データ削除リクエスト
        resistDeleteDataEvent,
        // データ送信リクエスト
        resistSendDataEvent,
        // データ一括追加リクエスト
        resistAddDirectEvent,
        // メディアアップロードリクエスト
        resistUploadMediaEvent,
        // ファイル削除リクエスト
        resistDeleteFileEvent,
        // 部屋プリセットデータ登録
        resistAddRoomPresetDataEvent,
        // データ削除リクエスト
        resistDeleteDataPackageEvent,
        // データインポート
        resistImportDataEvent
      ].forEach((r: Resister) => r(driver, socket, io, db));
    });

    // 5分おきにトークン情報を整理する
    setInterval(async () => {
      console.log("-- TOKEN REFRESH --");
      const now = new Date();
      await Promise.all(
        (await findList<TokenStore>(driver, SYSTEM_COLLECTION.TOKEN_LIST))!
          .filter(doc => doc.data!.expires.getTime() < now.getTime())
          .map(doc => {
            console.log(`Expired: ${doc.data!.token}`);
            return doc.ref.delete();
          })
      );
    }, 1000 * 60 * 5); // 5分

  } catch (err) {
    console.error("MongoDB connect fail.");
    console.error(err);
  }
}

async function initDataBase(driver: Driver): Promise<void> {
  // 部屋情報の入室人数を0人にリセット
  (await driver.collection<StoreData<RoomStore>>(SYSTEM_COLLECTION.ROOM_LIST).get()).docs.forEach(async roomDoc => {
    if (roomDoc.exists() && roomDoc.data.data) {
      const roomData = roomDoc.data.data!;
      roomData.memberNum = 0;
      const roomCollectionPrefix = roomData.roomCollectionPrefix;
      await roomDoc.ref.update({
        data: roomData
      });

      const roomUserCollectionName = `${roomCollectionPrefix}-DATA-user-list`;
      (await driver.collection<StoreData<UserStore>>(roomUserCollectionName).get()).docs.forEach(async userDoc => {
        if (userDoc.exists() && userDoc.data.data) {
          const userData = userDoc.data.data!;
          userData.login = 0;
          await userDoc.ref.update({
            data: userData
          });
        }
      });
    }
  });

  // 全てのタッチ状態を解除
  await Promise.all((await driver.collection<TouchierStore>(SYSTEM_COLLECTION.TOUCH_LIST).get()).docs
    .filter(doc => doc && doc.exists())
    .map(doc => doc.data!.socketId)
    .filter((socketId, i, self) => self.indexOf(socketId) === i)
    .map(socketId => new Promise<void>(async (resolve, reject) => {
      try {
        await releaseTouch(driver, socketId);
        resolve();
      } catch (err) {
        reject(err);
      }
    })));

  // タッチ情報を全削除
  (await driver.collection<TouchierStore>(SYSTEM_COLLECTION.TOUCH_LIST).get()).docs.forEach(async doc => {
    if (doc.exists()) {
      await doc.ref.delete();
    }
  });

  // Socket接続情報を全削除
  (await driver.collection<StoreData<SocketStore>>(SYSTEM_COLLECTION.SOCKET_LIST).get()).docs.forEach(async doc => {
    if (doc.exists()) {
      await doc.ref.delete();
    }
  });
}

main().then();
