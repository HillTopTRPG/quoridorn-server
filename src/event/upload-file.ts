import {accessUrl, bucket, Resister, s3Client} from "../server";
import {getSocketDocSnap, notifyProgress, setEvent} from "./common";
import Driver from "nekostore/lib/Driver";
import {UploadFileInfo, UploadFileRequest} from "../@types/socket";
import * as path from "path";
import {SocketStore} from "../@types/data";

// インタフェース
const eventName = "upload-file";
type RequestType = UploadFileRequest;
type ResponseType = string[]; // download url

/**
 * メディアファイルアップロード処理
 * @param driver
 * @param socket
 * @param arg
 */
async function uploadFile(driver: Driver, socket: any, arg: RequestType): Promise<ResponseType> {
  const snap = (await getSocketDocSnap(driver, socket.id));
  const socketData: SocketStore = snap.data!;
  const storageId = socketData.storageId!;

  const urlList: string[] = [];
  const uploadFunc = async (info: UploadFileInfo): Promise<void> => {
    // 進捗報告
    notifyProgress(socket, arg.length, urlList.length);

    // アップロード
    const filePath = path.join(storageId, info.name);
    await s3Client!.putObject(bucket, filePath, info.src);
    // XXX 以下の方法だと、「https://~~」が「http:/~~」になってしまうことが判明したので、単純連結に変更
    // urlList.push(path.join(accessUrl, filePath));
    urlList.push(accessUrl + filePath);
  };

  // 直列の非同期で全部実行する
  await arg
    .map((info: UploadFileInfo) => () => uploadFunc(info))
    .reduce((prev, curr) => prev.then(curr), Promise.resolve());

  // 進捗報告
  notifyProgress(socket, arg.length, urlList.length);

  return urlList;
}

const resist: Resister = (driver: Driver, socket: any): void => {
  setEvent<RequestType, ResponseType>(driver, socket, eventName, (driver: Driver, arg: RequestType) => uploadFile(driver, socket, arg));
};
export default resist;
