import {UploadMediaInfo} from "../@types/socket";
import {accessLog, errorLog} from "./logger";
import Driver from "nekostore/lib/Driver";
import {Permission} from "../@types/store";

/**
 * リクエスト処理を登録するための関数。
 * @param driver
 * @param socket
 * @param eventName
 * @param func
 */
export function setEvent<T, U>(driver: Driver, socket: any, eventName: string, func: (driver: Driver, arg: T, permission?: Permission) => Promise<U>) {
  const resultEvent = `result-${eventName}`;
  socket.on(eventName, async (arg: T) => {
    const logArg = arg ? JSON.parse(JSON.stringify(arg)) : null;
    if (eventName === "upload-media") {
      logArg.uploadMediaInfoList.forEach((info: UploadMediaInfo) => {
        info.imageSrc = "[Binary Array]";
        if (info.dataLocation === "server") {
          delete info.blob;
          delete info.arrayBuffer;
        }
      });
    }
    accessLog(socket.id, eventName, "START", logArg);
    try {
      const result = await func(driver, arg);
      accessLog(socket.id, eventName, "END  ", result);
      socket.emit(resultEvent, null, result);
    } catch (err) {
      // アクセスログは必ず閉じる
      accessLog(socket.id, eventName, "ERROR");

      // エラーの内容はエラーログを見て欲しい（アクセスログはシンプルにしたい）
      const errorMessage = "message" in err ? err.message : err;
      errorLog(socket.id, eventName, errorMessage);

      socket.emit(resultEvent, err, null);
    }
  });
}
