import {bucket, Resister, s3Client} from "../server";
import {getSocketDocSnap, setEvent} from "./common";
import Driver from "nekostore/lib/Driver";
import {DeleteFileRequest} from "../@types/socket";
import * as path from "path";

// インタフェース
const eventName = "delete-file";
type RequestType = DeleteFileRequest;
type ResponseType = void;

/**
 * メディアファイル削除処理
 * @param driver
 * @param socket
 * @param arg
 */
async function deleteFile(driver: Driver, socket: any, arg: RequestType): Promise<ResponseType> {
  const snap = (await getSocketDocSnap(driver, socket.id));
  const storageId = snap.data!.storageId!;
  const filePathList = arg.filePathList.map(p => path.join(storageId, p));

  await s3Client!.removeObjects(bucket, filePathList);
}

const resist: Resister = (driver: Driver, socket: any): void => {
  setEvent<RequestType, ResponseType>(driver, socket, eventName, (driver: Driver, arg: RequestType) => deleteFile(driver, socket, arg));
};
export default resist;
