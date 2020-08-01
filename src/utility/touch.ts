import Driver from "nekostore/lib/Driver";
import {TouchierStore} from "../@types/data";
import {SYSTEM_COLLECTION} from "../server";
import DocumentChange from "nekostore/lib/DocumentChange";
import {SystemError} from "../error/SystemError";
import Query from "nekostore/lib/Query";
import DocumentSnapshot from "nekostore/lib/DocumentSnapshot";
import {StoreObj} from "../@types/store";

export async function addTouchier(
  driver: Driver,
  socketId: string,
  collection: string,
  id: string,
  updateTime: Date | null
): Promise<void> {
  const c = driver.collection<TouchierStore>(SYSTEM_COLLECTION.TOUCH_LIST);
  const doc: DocumentChange<TouchierStore> = (await c
  .where("socketId", "==", socketId)
  .where("collection", "==", collection)
  .where("id", "==", id)
  .get()).docs[0];
  if (doc) {
    // あり得ないけど一応存在チェック
    throw new SystemError(`Touchier is Exist. collection: ${collection}, id: ${id}, socketId: ${socketId}`);
  }
  await c.add({
    socketId,
    collection,
    docId: id,
    time: new Date(),
    backupUpdateTime: updateTime
  });
}

export async function deleteTouchier(
  driver: Driver,
  socketId: string,
  collection?: string,
  id?: string
): Promise<Date | null> {
  const c = driver.collection<TouchierStore>(SYSTEM_COLLECTION.TOUCH_LIST);
  let q: Query<TouchierStore> = c.where("socketId", "==", socketId);
  if (collection !== undefined)
    q = q.where("collection", "==", collection);
  if (id !== undefined)
    q = q.where("docId", "==", id);
  const docList: DocumentChange<TouchierStore>[] = (await q.get()).docs;
  if (!docList || !docList.length) {
    console.warn(`deleteTouchier失敗 socket: ${socketId}, collection: ${collection}, id: ${id}`);
    return null;
  }

  const backupUpdateTime = docList[0].data ? docList[0].data.backupUpdateTime : null;

  const deleteList = async (doc: DocumentSnapshot<TouchierStore>): Promise<void> => {
    await doc.ref.delete();
  };
  await docList
  .map((doc: DocumentSnapshot<TouchierStore>) => () => deleteList(doc))
  .reduce((prev, curr) => prev.then(curr), Promise.resolve());

  return backupUpdateTime;
}

export async function releaseTouch(
  driver: Driver,
  socketId: string,
  collection?: string,
  id?: string
): Promise<void> {
  const c = driver.collection<TouchierStore>(SYSTEM_COLLECTION.TOUCH_LIST);
  let q: Query<TouchierStore> = c.where("socketId", "==", socketId);
  if (collection !== undefined)
    q = q.where("collection", "==", collection);
  if (id !== undefined)
    q = q.where("id", "==", id);
  const docList: DocumentChange<TouchierStore>[] = (await q.get()).docs;
  if (!docList || !docList.length) return;
  docList.forEach(async doc => {
    if (doc.exists()) {
      const { collection, docId } = doc.data;
      const targetCollection = driver.collection<StoreObj<any>>(collection);
      const target = await targetCollection.doc(docId).get();
      if (target.exists()) {
        if (target.data.data) {
          await target.ref.update({
            exclusionOwner: null
          });
        } else {
          await target.ref.delete();
        }
      }
    }
    await doc.ref.delete();
  });
}
