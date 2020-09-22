import Driver from "nekostore/lib/Driver";
import {MediaInfo, RoomStore} from "../@types/data";
import {StoreObj} from "../@types/store";
import {accessUrl, bucket, s3Client} from "../server";
import DocumentSnapshot from "nekostore/lib/DocumentSnapshot";
import {ApplicationError} from "../error/ApplicationError";
import {findList} from "./collection";

export async function doDeleteRoom(
  driver: Driver,
  db: any,
  doc: DocumentSnapshot<StoreObj<RoomStore>>
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
  const deleteUrlList = (await findList<StoreObj<MediaInfo>>(driver, `${roomCollectionPrefix}-DATA-media-list`))!
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
