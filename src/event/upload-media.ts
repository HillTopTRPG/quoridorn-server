import {accessUrl, bucket, Resister, s3Client} from "../server";
import Driver from "nekostore/lib/Driver";
import {UploadMediaInfo, UploadMediaRequest, UploadMediaResponse} from "../@types/socket";
import * as path from "path";
import {SocketStore} from "../@types/data";
import {setEvent} from "../utility/server";
import {notifyProgress} from "../utility/emit";
import {findSingle, getSocketDocSnap} from "../utility/collection";
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
  const mediaListCCName = `${roomCollectionPrefix}-DATA-media-list`;

  const uploadMediaInfoList = arg.uploadMediaInfoList;
  const total = uploadMediaInfoList.length * 2;

  const mediaList: Partial<StoreData<MediaStore>>[] = [];
  const rawPathList: string[] = arg.uploadMediaInfoList.map(umi => umi.rawPath);
  const duplicateMediaList: StoreData<MediaStore>[] = [];

  const uploadFunc = async (info: UploadMediaInfo, idx: number): Promise<void> => {
    // 進捗報告
    notifyProgress(socket, total, idx);
    let mediaFileId = "";

    let volatileKey: string | undefined = undefined;

    if (info.dataLocation === "server") {
      const hashSameMedia = await findSingle<StoreData<MediaStore>>(
        driver,
        mediaListCCName,
        "data.rawPath",
        info.rawPath
      );
      if (hashSameMedia && hashSameMedia.exists()) {
        duplicateMediaList.push(hashSameMedia.data);
        return;
      }
      // アップロード
      mediaFileId = uuid.v4();
      const filePath = path.join(storageId, mediaFileId);
      await s3Client!.putObject(bucket, filePath, info.arrayBuffer);
      // XXX 以下の方法だと、「https://~~」が「http:/~~」になってしまうことが判明したので、単純連結に変更
      // urlList.push(path.join(accessUrl, filePath));
      info.url = accessUrl + filePath;
    } else {
      const hashSameMedia = await findSingle<StoreData<MediaStore>>(
        driver,
        mediaListCCName,
        "data.url",
        info.url
      );
      if (hashSameMedia && hashSameMedia.exists()) {
        duplicateMediaList.push(hashSameMedia.data);
        return;
      }
    }

    mediaList.push({
      key: info.key,
      data: {
        name: info.name,
        rawPath: info.rawPath,
        mediaFileId,
        tag: info.tag,
        url: info.url,
        urlType: info.urlType,
        iconClass: info.iconClass,
        imageSrc: info.imageSrc,
        dataLocation: info.dataLocation
      }
    });
  };

  // 直列の非同期で全部実行する
  await arg.uploadMediaInfoList
    .map((info, idx) => () => uploadFunc(info, idx))
    .reduce((prev, curr) => prev.then(curr), Promise.resolve());

  // mediaListに追加
  const keyList: string[] = await addDirect<MediaStore>(driver, socket, {
    collection: mediaListCCName,
    list: mediaList.map(data => ({
      ...arg.option,
      key: data.key,
      data: data.data!
    }))
  }, true, uploadMediaInfoList.length, total);

  // 進捗報告
  notifyProgress(socket, total, total);

  return keyList.map((key, idx) => ({
    key,
    rawPath: rawPathList[idx],
    url: mediaList[idx].data!.url,
    name: mediaList[idx].data!.name,
    tag: mediaList[idx].data!.tag,
    urlType: mediaList[idx].data!.urlType
  }));
}

const resist: Resister = (driver: Driver, socket: any): void => {
  setEvent<RequestType, ResponseType>(driver, socket, eventName, (driver: Driver, arg: RequestType) => uploadMedia(driver, socket, arg));
};
export default resist;
