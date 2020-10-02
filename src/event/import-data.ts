import {Resister} from "../server";
import Driver from "nekostore/lib/Driver";
import {SocketStore} from "../@types/data";
import {setEvent} from "../utility/server";
import {getSocketDocSnap} from "../utility/collection";
import {addDirect} from "./add-direct";
import {ImportRequest} from "../@types/socket";

// インタフェース
const eventName = "import-data";
type RequestType = ImportRequest;
type ResponseType = void;

const collectionOrderList: string[] = [
  "user-list",
  "actor-list",
  "media-list"
];

/**
 * データインポート処理
 * @param driver
 * @param socket
 * @param arg
 */
async function importData(driver: Driver, socket: any, arg: RequestType): Promise<ResponseType> {
  const snap = (await getSocketDocSnap(driver, socket.id));
  const socketData: SocketStore = snap.data!;
  const roomCollectionPrefix = socketData.roomCollectionPrefix;

  const listMap: {
    [collection: string]: (Partial<StoreData<any>> & { data: any })[]
  } = {};

  arg.list.forEach(a => {
    const listMapElm = listMap[a.collection];
    if (listMapElm) {
      listMapElm.push({
        key: a.key,
        collection: a.collection,
        ownerType: a.ownerType,
        owner: a.owner,
        order: a.order,
        permission: a.permission,
        data: a.data
      });
    } else {
      listMap[a.collection] = [{
        key: a.key,
        collection: a.collection,
        ownerType: a.ownerType,
        owner: a.owner,
        order: a.order,
        permission: a.permission,
        data: a.data
      }]
    }
  });

  await Object.keys(listMap)
    .sort((cn1, cn2) => {
      let cn1Index = collectionOrderList.findIndex(cn => cn === cn1);
      let cn2Index = collectionOrderList.findIndex(cn => cn === cn2);
      if (cn1Index === cn2Index) return 0;
      if (cn1Index === -1) return 1;
      if (cn2Index === -1) return -1;
      return cn1Index < cn2Index ? -1 : 1;
    })
    .map(collection => {
      return async () => {
        await addDirect<any>(driver, socket, {
          collection: `${roomCollectionPrefix}-DATA-${collection}`,
          list: listMap[collection],
          importType: arg.importType
        })
      };
    })
    .reduce((prev, curr) => prev.then(curr), Promise.resolve());
}

const resist: Resister = (driver: Driver, socket: any): void => {
  setEvent<RequestType, ResponseType>(driver, socket, eventName, (driver: Driver, arg: RequestType) => importData(driver, socket, arg));
};
export default resist;
