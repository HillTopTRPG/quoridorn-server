import Driver from "nekostore/lib/Driver";
import {RoomStore} from "../@types/data";
import {StoreObj} from "../@types/store";
import {accessUrl, bucket, s3Client} from "../server";
import DocumentSnapshot from "nekostore/lib/DocumentSnapshot";
import {ApplicationError} from "../error/ApplicationError";

export async function doDeleteRoom(
  driver: Driver,
  db: any,
  docSnap: DocumentSnapshot<StoreObj<RoomStore>>
): Promise<void> {
  const data = docSnap.data!.data;

  try {
    await docSnap.ref.delete();
  } catch (err) {
    throw new ApplicationError(`Failure delete doc.`);
  }

  if (!data) return;

  const storageId = data.storageId;
  const roomCollectionPrefix = data.roomCollectionPrefix;

  // メディアコレクションからメディアストレージの削除
  const mediaCCName = `${roomCollectionPrefix}-DATA-media-list`;
  const mediaCC = driver.collection<StoreObj<{ url: string }>>(mediaCCName);
  const deleteUrlList = (await mediaCC.get()).docs.map(d => d.data!.data!.url)
    .map(url => url.replace(accessUrl, ""))
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
    const cnCC = driver.collection<{ name: string }>(collectionNameCollectionName);
    (await cnCC.get()).docs.map(d => d.data!.name).forEach(name => {
      deleteCollection(name);
    });
    deleteCollection(collectionNameCollectionName);
  }
}
