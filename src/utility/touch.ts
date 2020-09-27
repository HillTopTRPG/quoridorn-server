import Driver from "nekostore/lib/Driver";
import {TouchierStore} from "../@types/data";
import {SYSTEM_COLLECTION} from "../server";
import {SystemError} from "../error/SystemError";
import {findList, findSingle} from "./collection";

export async function addTouchier(
  driver: Driver,
  socketId: string,
  collection: string,
  key: string,
  updateTime: Date | null
): Promise<void> {
  const c = driver.collection<TouchierStore>(SYSTEM_COLLECTION.TOUCH_LIST);
  const docList = await findList<TouchierStore>(
    driver,
    SYSTEM_COLLECTION.TOUCH_LIST,
    [
      { property: "socketId", operand: "==", value: socketId },
      { property: "collection", operand: "==", value: collection },
      { property: "key", operand: "==", value: key }
    ]);
  if (docList && docList.length) {
    // あり得ないけど一応存在チェック
    throw new SystemError(`Touchier is Exist. collection: ${collection}, key: ${key}, socketId: ${socketId}`);
  }
  await c.add({
    socketId,
    collection,
    key,
    time: new Date(),
    backupUpdateTime: updateTime
  });
}

export async function deleteTouchier(
  driver: Driver,
  socketId: string,
  collection?: string,
  key?: string
): Promise<Date | null> {
  const options: { property: string; operand: "=="; value: any }[] = [];
  options.push({ property: "socketId", operand: "==", value: socketId });
  if (collection !== undefined)
    options.push({ property: "collection", operand: "==", value: collection });
  if (key !== undefined)
    options.push({ property: "key", operand: "==", value: key });

  const docList = await findList<TouchierStore>(
    driver,
    SYSTEM_COLLECTION.TOUCH_LIST,
    options
  );
  if (!docList || !docList.length) {
    console.warn(`deleteTouchier失敗 socket: ${socketId}, collection: ${collection}, key: ${key}`);
    return null;
  }

  const backupUpdateTime = docList[0].data ? docList[0].data.backupUpdateTime : null;

  // 非同期処理で順次消していく
  await docList
    .map(doc => () => doc.ref.delete())
    .reduce((prev, curr) => prev.then(curr), Promise.resolve());

  return backupUpdateTime;
}

export async function releaseTouch(
  driver: Driver,
  socketId: string,
  collection?: string,
  key?: string
): Promise<void> {
  const options: { property: string; operand: "=="; value: any }[] = [];
  options.push({ property: "socketId", operand: "==", value: socketId });
  if (collection !== undefined)
    options.push({ property: "collection", operand: "==", value: collection });
  if (key !== undefined)
    options.push({ property: "key", operand: "==", value: key });

  const docList = await findList<TouchierStore>(
    driver,
    SYSTEM_COLLECTION.TOUCH_LIST,
    options
  );

  if (!docList || !docList.length) return;

  await Promise.all(docList.map(async doc => {
    if (doc.exists()) {
      const { collection, key } = doc.data;
      const target = await findSingle<StoreData<any>>(driver, collection, "key", key);
      if (target && target.exists()) {
        target.data.data
          ? await target.ref.update({ exclusionOwner: null })
          : await target.ref.delete()
      }
    }
    await doc.ref.delete();
  }));
}
