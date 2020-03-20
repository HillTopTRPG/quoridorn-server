import {Resister} from "../server";
import {getSocketDocSnap, setEvent} from "./common";
import Driver from "nekostore/lib/Driver";
import {UploadFileInfo, UploadFileRequest} from "../@types/socket";
import {StorageSetting} from "../@types/server";
import YAML from "yaml";
import fs from "fs";
import * as path from "path";
import Minio from "minio";
import {SocketStore} from "../@types/data";

export const storageSetting: StorageSetting = YAML.parse(fs.readFileSync(path.resolve(__dirname, "../../config/storage.yaml"), "utf8"));
console.log(JSON.stringify(storageSetting, null, "  "));

let s3Client: Minio.Client | null = null;
try {
  s3Client = new Minio.Client({
    endPoint: storageSetting.endPoint,
    port: storageSetting.port,
    useSSL: storageSetting.useSSL,
    accessKey: storageSetting.accessKey,
    secretKey: storageSetting.secretKey
  });
} catch (err) {
  console.error("## S3ストレージへの接続ができませんでした。");
  console.error("## config/storage.yamlの内容を見直してください。");
  console.error("## 以下は minioエラーメッセージ");
  console.error(err);
}

// Bucket作成
function createBucket() {
  s3Client!.makeBucket(storageSetting.bucket, storageSetting.region, (err: any) => {
    if(err) {
      console.log(err);
      return;
    }

    console.log('Bucket created successfully in ', storageSetting.region);
    console.log('Created bucket name  => ', storageSetting.bucket);
  });
}
createBucket();

async function upload(src: string, fileType: {[key: string]: any}, filePath: string): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    s3Client!.fPutObject(storageSetting.bucket, src, filePath, fileType, function(err: any) {
      if(err) {
        reject(err);
        return;
      }
      resolve(path.join(storageSetting.accessUrl, filePath));
    });
  });
}

// インタフェース
const eventName = "upload-file";
type RequestType = UploadFileRequest;
type ResponseType = string[];

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
  const addFunc = async (info: UploadFileInfo): Promise<void> => {
    // 着手報告
    socket.emit("upload-process", null, {
      all: arg.length,
      current: urlList.length
    });

    // アップロード
    const filePath = path.join(storageId, info.name);
    urlList.push(await upload(info.src, {}, filePath));
  };

  // 直列の非同期で全部実行する
  await arg
    .map((info: UploadFileInfo) => () => addFunc(info))
    .reduce((prev, curr) => prev.then(curr), Promise.resolve());

  return urlList;
}

const resist: Resister = (driver: Driver, socket: any): void => {
  setEvent<RequestType, ResponseType>(driver, socket, eventName, (driver: Driver, arg: RequestType) => uploadFile(driver, socket, arg));
};
export default resist;
