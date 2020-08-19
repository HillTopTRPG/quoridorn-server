import {accessUrl, bucket, Resister, s3Client} from "../server";
import Driver from "nekostore/lib/Driver";
import {UploadMediaInfo, UploadMediaRequest, UploadMediaResponse} from "../@types/socket";
import * as path from "path";
import {MediaInfo, SocketStore} from "../@types/data";
import {setEvent} from "../utility/server";
import {notifyProgress} from "../utility/emit";
import {getSocketDocSnap} from "../utility/collection";
import {addDirect} from "./add-direct";
import uuid = require("uuid");

// インタフェース
const eventName = "upload-media";
type RequestType = UploadMediaRequest;
type ResponseType = UploadMediaResponse;

/**
 * メディアファイルアップロード処理
 * @param driver
 * @param socket
 * @param arg
 */
async function uploadMedia(driver: Driver, socket: any, arg: RequestType): Promise<ResponseType> {
  const snap = (await getSocketDocSnap(driver, socket.id));
  const socketData: SocketStore = snap.data!;
  const storageId = socketData.storageId!;
  const roomCollectionPrefix = socketData.roomCollectionPrefix;

  const uploadMediaInfoList = arg.uploadMediaInfoList;
  const total = uploadMediaInfoList.length * 2;

  const mediaList: MediaInfo[] = [];
  const oldUrlList: string[] = arg.uploadMediaInfoList.map(umi => umi.url);

  const uploadFunc = async (info: UploadMediaInfo, idx: number): Promise<void> => {
    // 進捗報告
    notifyProgress(socket, total, idx);

    // アップロード
    if (info.dataLocation === "server") {
      const filePath = path.join(storageId, uuid.v4());
      await s3Client!.putObject(bucket, filePath, info.arrayBuffer);

      // XXX 以下の方法だと、「https://~~」が「http:/~~」になってしまうことが判明したので、単純連結に変更
      // urlList.push(path.join(accessUrl, filePath));
      info.url = accessUrl + filePath;
    }

    mediaList.push({
      name: info.name,
      tag: info.tag,
      url: info.url,
      urlType: info.urlType,
      iconClass: info.iconClass,
      imageSrc: info.imageSrc,
      dataLocation: info.dataLocation
    });
  };

  // 直列の非同期で全部実行する
  await arg.uploadMediaInfoList
    .map((info: UploadMediaInfo, idx: number) => () => uploadFunc(info, idx))
    .reduce((prev, curr) => prev.then(curr), Promise.resolve());

  // mediaListに追加
  const mediaListCCName = `${roomCollectionPrefix}-DATA-media-list`;
  const idList: string[] = await addDirect(driver, socket, {
    collection: mediaListCCName,
    dataList: mediaList,
    optionList: mediaList.map(() => arg.option)
  }, true, uploadMediaInfoList.length, total);

  // 進捗報告
  notifyProgress(socket, total, total);

  return idList.map((id: string, idx: number) => ({
    docId: id,
    oldUrl: oldUrlList[idx],
    url: mediaList[idx].url,
    name: mediaList[idx].name,
    tag: mediaList[idx].tag,
    urlType: mediaList[idx].urlType
  }));
}

const resist: Resister = (driver: Driver, socket: any): void => {
  setEvent<RequestType, ResponseType>(driver, socket, eventName, (driver: Driver, arg: RequestType) => uploadMedia(driver, socket, arg));
};
export default resist;
