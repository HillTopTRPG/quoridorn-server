import BasicDriver from "nekostore/lib/driver/basic";
import SocketDriverServer from "nekostore/lib/driver/socket/SocketDriverServer";
import {RoomInfo, StoreRoomInfo} from "./@types/room";
import {StoreMetaData, StoreObj} from "./@types/store";
import fs from "fs";
import YAML from "yaml";
import Driver from "nekostore/src/Driver";
import {SystemError} from "./SystemError";
import {ApplicationError} from "./ApplicationError";
import uuid from "uuid";
import {ServerSetting} from "./@types/server";
import {hash, verify} from "./password";
import * as path from "path";

const serverSetting: ServerSetting = YAML.parse(fs.readFileSync(path.resolve(__dirname, "../conf/server.yaml"), "utf8"));

const driver = new BasicDriver();

/**
 * 部屋情報一覧（サーバ設定の部屋数の数の長さの配列）を返却する
 * @param driver
 */
async function getRoomList(driver: Driver): Promise<(StoreObj<RoomInfo> & StoreMetaData)[]> {
  try {
    const c = driver.collection<StoreObj<StoreRoomInfo>>("quoridorn-room-list");
    const infoList: (StoreObj<RoomInfo> & StoreMetaData)[] = (await c.orderBy("order").get()).docs
      .filter(doc => doc.exists())
      .map(doc => {
        const data: StoreObj<StoreRoomInfo> = doc.data!;
        if (data.data.password) data.data.password = "exist";
        const result = {
          ...data,
          id: doc.ref.id,
          createTime: doc.createTime ? doc.createTime.toDate() : null,
          updateTime: doc.updateTime ? doc.updateTime.toDate() : null
        };
        delete result.data.tableName;
        return result;
      });
    for (let i = 0; i < serverSetting.roomNum; i++) {
      if (infoList[i] && infoList[i].order === i) continue;
      infoList.splice(i, 1, {
        order: i,
        exclusionOwner: null,
        id: null,
        createTime: null,
        updateTime: null
      });
    }
    return infoList;
  } catch(err) {
    console.error(err);
    throw err;
  }
}

/**
 * 部屋作成着手処理
 * @param driver
 * @param no
 * @param exclusionOwner
 */
async function touchRoom(driver: Driver, no: number, exclusionOwner: string): Promise<void> {
  // console.log(`touchRoom room-no=${no}, exclusionOwner=${exclusionOwner}`);
  const c = await driver.collection<StoreObj<StoreRoomInfo>>("quoridorn-room-list");
  const docList = (await c.where("order", "==", no).get()).docs;
  // console.log(docList.length);
  if (!docList.length) {
    // console.log("add");
    c.add({
      order: no,
      exclusionOwner
    });
    return;
  }

  // console.log("update");
  const doc = docList[0];
  if (doc.data.exclusionOwner) throw new ApplicationError(`Already touched room. room-no=${no}`);
  doc.ref.update({
    exclusionOwner
  });
}

/**
 * 部屋作成処理
 * @param driver
 * @param no
 * @param roomInfo
 * @param exclusionOwner
 */
async function createRoom(driver: Driver, no: number, roomInfo: RoomInfo, exclusionOwner: string): Promise<string> {
  // console.log("createRoom", no, roomInfo);
  const c = await driver.collection<StoreObj<StoreRoomInfo>>("quoridorn-room-list");
  const docList = (await c.where("order", "==", no).get()).docs;
  if (!docList.length) throw new Error(`No such room error. room-no=${no}`);

  const doc = docList[0];
  const data = doc.data;
  if (!data.exclusionOwner) throw new ApplicationError(`Illegal operation. room-no=${no}`);
  if (data.exclusionOwner !== exclusionOwner) throw new ApplicationError(`Other player touched. room-no=${no}`);

  roomInfo.password = await hash(roomInfo.password, "bcrypt");

  const tableName = uuid.v4();
  doc.ref.update({
    exclusionOwner: null,
    data: {
      tableName,
      ...roomInfo
    }
  });
  return tableName;
}

async function getRoomInfo(driver: Driver, no: number): Promise<(StoreObj<StoreRoomInfo> & StoreMetaData) | null> {
  const docList = (await driver.collection<StoreObj<StoreRoomInfo>>("quoridorn-room-list")
  .where("order", "==", no)
  .get()).docs;
  if (!docList.length) return null;

  const doc = docList[0];
  return {
    ...doc.data!,
    id: doc.ref.id,
    createTime: doc.createTime ? doc.createTime.toDate() : null,
    updateTime: doc.updateTime ? doc.updateTime.toDate() : null
  };
}

/**
 * ログイン処理
 * @param driver
 * @param no
 * @param password
 */
async function login(driver: Driver, no: number, password: string): Promise<string | null> {
  const roomInfo = await getRoomInfo(driver, no);
  if (!roomInfo || !roomInfo.data) throw new Error(`No such room error. room-no=${no}`);

  try {
    if (await verify(roomInfo.data.password, password, "bcrypt")) {
      return roomInfo.data.tableName;
    } else {
      return null;
    }
  } catch (err) {
    throw new SystemError(`Login verify fatal error. room-no=${no}`);
  }
}

function main(socket: any) {
  console.log("Connected", socket.id);

  // nekostore起動！
  new SocketDriverServer(driver, socket);

  // 部屋情報一覧取得リクエスト
  socket.on("get-room-list", async () => {
    try {
      socket.emit("result-get-room-list", null, await getRoomList(driver));
    } catch(err) {
      console.error(err.toString());
      socket.emit("result-get-room-list", err, null);
    }
  });

  // 部屋作成着手リクエスト
  socket.on("touch-room", async ({ no }: { no: number }) => {
    try {
      await touchRoom(driver, no, socket.id);
      socket.emit("result-touch-room", null, null);
    } catch(err) {
      console.error(err.toString());
      socket.emit("result-touch-room", err.toString(), null);
    }
  });

  // 部屋作成リクエスト
  socket.on("create-room", async ({ no, roomInfo }: { no: number; roomInfo: RoomInfo }) => {
    try {
      socket.emit("result-create-room", null, await createRoom(driver, no, roomInfo, socket.id));
    } catch(err) {
      console.error(err.toString());
      socket.emit("result-create-room", err.toString(), null);
    }
  });

  // ログインリクエスト
  socket.on("login", async ({ no, password = "" }: { no: number; password: string }) => {
    try {
      socket.emit("result-login", null, await login(driver, no, password));
    } catch(err) {
      console.error(err.toString());
      socket.emit("result-login", err.toString(), null);
    }
  });

  // setInterval(async () => {
  //   const c = driver.collection<RoomInfo & StoreObj>("quoridorn-room-list");
  //   const dataList: (RoomInfo & StoreObj & StoreMetaData)[] = (await c.orderBy("updateTime").get()).docs
  //   .filter(doc => doc.data)
  //   .map(doc => {
  //     return {
  //       ...doc.data!,
  //       createTime: doc.createTime ? doc.createTime.toDate() : null,
  //       updateTime: doc.updateTime ? doc.updateTime.toDate() : null
  //     };
  //   });
  //   console.log(`-- logging(${ dataList.length }) --`);
  //   // dataList.forEach(data => {
  //   //   console.log(data);
  //   // });
  // },3000);

}

require("socket.io").listen(serverSetting.port).on("connection", main);
