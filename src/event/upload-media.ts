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
import {equals, getFileHash} from "../utility/data";

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

  type CheckedInfo = {
    key: string;
    existKey: string | null;
    rawInfo: UploadMediaInfo
  };
  const checkedList: CheckedInfo[] = [];

  const duplicateCheck = async (info: UploadMediaInfo): Promise<void> => {
    if (info.key === undefined) info.key = uuid.v4();

    const hash = info.dataLocation === "server" ? getFileHash(info.arrayBuffer!) : info.url;
    const duplicateMedia = await findSingle<StoreData<MediaStore>>(
      driver,
      mediaListCCName,
      "data.hash",
      hash
    );

    let isDuplicate = Boolean(duplicateMedia && duplicateMedia.exists());
    info.hash = hash;

    if (isDuplicate && !equals(arg.option.permission, duplicateMedia!.data!.permission)) {
      isDuplicate = false;
    }
    if (isDuplicate && arg.option.ownerType !== duplicateMedia!.data!.ownerType) {
      isDuplicate = false;
    }
    if (isDuplicate && arg.option.owner !== duplicateMedia!.data!.owner) {
      isDuplicate = false;
    }
    if (isDuplicate) {
      info.url = duplicateMedia!.data!.data!.url;
    }

    checkedList.push({
      key: info.key!,
      existKey: isDuplicate ? duplicateMedia!.data!.key : null,
      rawInfo: info
    });
  };

  // 直列の非同期で全部実行する
  await arg.uploadMediaInfoList
    .map(info => () => duplicateCheck(info))
    .reduce((prev, curr) => prev.then(curr), Promise.resolve());

  const newList = checkedList.filter(info => !info.existKey);

  const total: number = newList.length + newList.filter(info => info.rawInfo.dataLocation === "server").length;
  let processCount: number = 0;

  const uploadFunc = async (info: CheckedInfo): Promise<void> => {
    // 進捗報告
    notifyProgress(socket, total, processCount++);

    let mediaFileId = "";

    // アップロード
    if (!info.existKey && info.rawInfo.dataLocation === "server") {
      mediaFileId = uuid.v4() + path.extname(info.rawInfo.rawPath);
      const filePath = path.join(storageId, mediaFileId);
      await s3Client!.putObject(bucket, filePath, info.rawInfo.arrayBuffer!);
      // XXX 以下の方法だと、「https://~~」が「http:/~~」になってしまうことが判明したので、単純連結に変更
      // urlList.push(path.join(accessUrl, filePath));
      info.rawInfo.url = accessUrl + filePath;
    }

    info.rawInfo.mediaFileId = mediaFileId;
  };

  // 直列の非同期で全部実行する
  await checkedList
    .map(info => () => uploadFunc(info))
    .reduce((prev, curr) => prev.then(curr), Promise.resolve());

  // mediaListに追加
  if (newList.length) {
    const keyList: string[] = await addDirect<MediaStore>(driver, socket, {
      collection: mediaListCCName,
      list: newList
        .map(data => ({
          ...arg.option,
          key: data.key,
          data: {
            name: data.rawInfo.name,
            rawPath: data.rawInfo.rawPath,
            hash: data.rawInfo.hash,
            mediaFileId: data.rawInfo.mediaFileId,
            tag: data.rawInfo.tag,
            url: data.rawInfo.url,
            urlType: data.rawInfo.urlType,
            iconClass: data.rawInfo.iconClass,
            imageSrc: data.rawInfo.imageSrc,
            dataLocation: data.rawInfo.dataLocation
          }
        }))
    }, true, processCount, total);
  }

  // 進捗報告
  notifyProgress(socket, total, total);

  return checkedList.map(info => ({
    key: info.existKey || info.key,
    rawPath: info.rawInfo.rawPath,
    url: info.rawInfo.url,
    name: info.rawInfo.name,
    tag: info.rawInfo.tag,
    urlType: info.rawInfo.urlType
  }));
}

const resist: Resister = (driver: Driver, socket: any): void => {
  setEvent<RequestType, ResponseType>(driver, socket, eventName, (driver: Driver, arg: RequestType) => uploadMedia(driver, socket, arg));
};
export default resist;
