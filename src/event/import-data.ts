import {accessUrl, bucket, Resister, s3Client} from "../server";
import Driver from "nekostore/lib/Driver";
import {SocketStore} from "../@types/data";
import {setEvent} from "../utility/server";
import {findList, getSocketDocSnap, splitCollectionName} from "../utility/collection";
import {addDirect} from "./add-direct";
import {ImportLevel, ImportRequest} from "../@types/socket";
import {Db} from "mongodb";

// インタフェース
const eventName = "import-data";
type RequestType = ImportRequest;
type ResponseType = void;

const collectionOrderList: string[] = [
  "user-list",
  "actor-list",
  "media-list"
];

const importLevelList: ImportLevel[] = [
  "full",
  "user",
  "actor",
  "part"
];

/**
 * データインポート処理
 * @param driver
 * @param socket
 * @param arg
 * @param db
 */
async function importData(driver: Driver, socket: any, arg: RequestType, db?: Db): Promise<ResponseType> {
  const snap = (await getSocketDocSnap(driver, socket.id));
  const socketData: SocketStore = snap.data!;
  const roomCollectionPrefix = socketData.roomCollectionPrefix;
  const storageId = socketData.socketId;

  const listMap: {
    importLevel: ImportLevel;
    collection: string;
    list: (Partial<StoreData<any>> & { data: any})[];
  }[] = [];

  if (arg["full"]) {
    // メディアコレクションからメディアストレージの削除
    const deleteUrlList = (await findList<StoreData<MediaStore>>(driver, `${roomCollectionPrefix}-DATA-media-list`))!
      .map(doc => doc.data!.data!.url.replace(accessUrl, ""))
      .filter(url => url.startsWith(storageId));
    await s3Client!.removeObjects(bucket, deleteUrlList);

    if (db) {
      // 部屋のコレクションの削除
      const deleteCollection = (name: string) => {
        const { roomCollectionSuffix } = splitCollectionName(name);
        if (roomCollectionSuffix === "user-list") return;
        db.collection(name).drop(() => {
          // args: err, delOK
          // nothing.
        });
      };
      const collectionNameCollectionName = `${roomCollectionPrefix}-DATA-collection-list`;
      (await findList<{ name: string }>(driver, collectionNameCollectionName))!
        .forEach(doc => deleteCollection(doc.data!.name));
    }
  }

  importLevelList
    .filter(importLevel => arg[importLevel])
    .forEach(importLevel => {
      const list = arg[importLevel];
      list.forEach(a => {
        let listMapElm = listMap.find(l => l.collection === a.collection);
        if (!listMapElm) {
          listMapElm = { collection: a.collection, list: [], importLevel };
          listMap.push(listMapElm);
        }
        listMapElm.list.push({
          key: a.key,
          collection: a.collection,
          ownerType: a.ownerType,
          owner: a.owner,
          order: a.order,
          permission: a.permission,
          data: a.data
        });
      });
    });

  const total = listMap.reduce((prev, curr) => prev + curr.list.length, 0);
  let current = 0;
  await listMap
    .sort((cn1, cn2) => {
      let cn1LevelIndex = importLevelList.findIndex(cn => cn === cn1.importLevel);
      let cn2LevelIndex = importLevelList.findIndex(cn => cn === cn2.importLevel);
      if (cn1LevelIndex < cn2LevelIndex) return -1;
      if (cn1LevelIndex > cn2LevelIndex) return 1;
      let cn1ColIndex = collectionOrderList.findIndex(cn => cn === cn1.collection);
      let cn2ColIndex = collectionOrderList.findIndex(cn => cn === cn2.collection);
      if (cn1ColIndex === cn2ColIndex) return 0;
      if (cn1ColIndex === -1) return 1;
      if (cn2ColIndex === -1) return -1;
      return cn1ColIndex < cn2ColIndex ? -1 : 1;
    })
    .map(obj => async () => {
      await addDirect<any>(driver, socket, {
        collection: `${roomCollectionPrefix}-DATA-${obj.collection}`,
        list: obj.list,
        importLevel: obj.importLevel
      }, true, current, total);
      current += obj.list.length;
    })
    .reduce((prev, curr) => prev.then(curr), Promise.resolve());
}

const resist: Resister = (driver: Driver, socket: any, db?: Db): void => {
  setEvent<RequestType, ResponseType>(driver, socket, eventName, (driver: Driver, arg: RequestType) => importData(driver, socket, arg, db));
};
export default resist;
