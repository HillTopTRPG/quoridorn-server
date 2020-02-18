import {Resister, SYSTEM_COLLECTION} from "../server";
import {getSocketDocSnap, setEvent} from "./common";
import Driver from "nekostore/lib/Driver";
import {SendDataRequest} from "../@types/socket";
import {SocketStore} from "../@types/data";

// インタフェース
const eventName = "send-data";
type RequestType = SendDataRequest;
type ResponseType = void;

/**
 * データ送信リクエスト
 * @param driver
 * @param socket
 * @param io
 * @param arg データ
 */
async function sendData(driver: Driver, socket: any, io: any, arg: RequestType): Promise<ResponseType> {
  const socketIdList: string[] = [];
  const socketDocSnap = (await getSocketDocSnap(driver, socket.id));

  const takeUserSocketId = async (userId: string): Promise<void> => {
    const socketDocSnapList = (await driver.collection<SocketStore>(SYSTEM_COLLECTION.SOCKET_LIST)
      .where("userId", "==", userId)
      .get())
      .docs
      .filter(doc => doc && doc.exists());

    // 見つからない場合はログアウトしている可能性があるので特にエラーにしない

    socketDocSnapList.forEach(sds => {
      // 絶対ないはずだが、他の部屋の人には送信しない。
      if (sds.data!.roomId !== socketDocSnap.data!.roomId) return;
      socketIdList.push(sds.data!.socketId);
    });
  };

  // 全ての検索が終わるまで待つ
  await Promise.all(arg.targetList.map(target => takeUserSocketId(target)));

  socketIdList.forEach(socketId => {
    io.to(socketId).emit('send-data', null, arg);
  });
}

const resist: Resister = (driver: Driver, socket: any, io: any): void => {
  setEvent<RequestType, ResponseType>(driver, socket, eventName, (driver: Driver, arg: RequestType) => sendData(driver, socket, io, arg));
};
export default resist;
