import Driver from "nekostore/lib/Driver";
import {RoomStore} from "../@types/data";
import {accessUrl, bucket, s3Client, SYSTEM_COLLECTION} from "../server";
import DocumentSnapshot from "nekostore/lib/DocumentSnapshot";
import {ApplicationError} from "../error/ApplicationError";
import {findList, findSingle} from "./collection";
import {updateSimple} from "./data";

/**
 * 部屋情報が更新された後の処理
 * @param driver
 * @param socket
 * @param collectionName
 * @param data
 */
export async function updateRoomDataRelation(
  driver: Driver,
  socket: any,
  collectionName: string,
  data: (Partial<StoreData<RoomDataStore>> & { key: string; continuous?: boolean; })
): Promise<void> {
  await updateSimple(driver, socket, collectionName, data);
  const doc = await findSingle<StoreData<RoomStore>>(
    driver,
    SYSTEM_COLLECTION.ROOM_LIST,
    "order",
    data.data!.roomNo
  );

  if (!doc) return;

  doc.data!.data!.name = data.data!.name;
  doc.data!.data!.system = data.data!.system;
  doc.data!.data!.bcdiceServer = data.data!.bcdiceServer;
  doc.data!.data!.bcdiceVersion = data.data!.bcdiceVersion;
  doc.data!.updateTime = new Date();

  await doc.ref.update(doc.data!);
}

export async function doDeleteRoom(
  driver: Driver,
  db: any,
  doc: DocumentSnapshot<StoreData<RoomStore>>
): Promise<void> {
  const data = doc.data!.data;

  try {
    await doc.ref.delete();
  } catch (err) {
    throw new ApplicationError(`Failure delete doc.`);
  }

  if (!data) return;

  const storageId = data.storageId;
  const roomCollectionPrefix = data.roomCollectionPrefix;

  // メディアコレクションからメディアストレージの削除
  const deleteUrlList = (await findList<StoreData<MediaStore>>(driver, `${roomCollectionPrefix}-DATA-media-list`))!
    .map(doc => doc.data!.data!.url.replace(accessUrl, ""))
    .filter(url => url.startsWith(storageId));
  await s3Client!.removeObjects(bucket, deleteUrlList);

  if (db) {
    // 部屋のコレクションの削除
    const deleteCollection = (name: string) => {
      db.collection(name).drop(() => {
        // args: err, delOK
        // nothing.
      });
    };
    const collectionNameCollectionName = `${roomCollectionPrefix}-DATA-collection-list`;
    (await findList<{ name: string }>(driver, collectionNameCollectionName))!
      .forEach(doc => deleteCollection(doc.data!.name));
    deleteCollection(collectionNameCollectionName);
  }
}
