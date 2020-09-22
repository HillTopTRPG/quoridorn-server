import {Resister, SYSTEM_COLLECTION} from "../server";
import Driver from "nekostore/lib/Driver";
import {SendDataRequest} from "../@types/socket";
import {SocketStore} from "../@types/data";
import {setEvent} from "../utility/server";
import {findList, getSocketDocSnap} from "../utility/collection";

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

  const takeUserSocketKey = async (userKey: string): Promise<void> => {
    const socketDocList = await findList<SocketStore>(
      driver,
      SYSTEM_COLLECTION.SOCKET_LIST,
      [
        { property: "userKey", operand: "==", value: userKey },
        { property: "roomKey", operand: "==", value: socketDocSnap.data!.roomKey },
      ]
    );
    socketIdList.push(
      ...socketDocList!.map(doc => doc.data!.socketId)
    );
  };

  // 全ての検索が終わるまで待つ
  await Promise.all(arg.targetList.map(userKey => takeUserSocketKey(userKey)));

  socketIdList.forEach(socketId => {
    io.to(socketId).emit('send-data', null, arg);
  });
}

const resist: Resister = (driver: Driver, socket: any, io: any): void => {
  setEvent<RequestType, ResponseType>(driver, socket, eventName, (driver: Driver, arg: RequestType) => sendData(driver, socket, io, arg));
};
export default resist;
