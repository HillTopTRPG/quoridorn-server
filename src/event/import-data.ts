import {Resister} from "../server";
import Driver from "nekostore/lib/Driver";
import {SocketStore} from "../@types/data";
import {setEvent} from "../utility/server";
import {getSocketDocSnap} from "../utility/collection";
import {StoreObj} from "../@types/store";
import {addDirect} from "./add-direct";

// インタフェース
const eventName = "import-data";
type RequestType = StoreObj<any>[];
type ResponseType = void;

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
    [collection: string]: (Partial<StoreObj<any>> & { data: any })[]
  } = {};

  arg.forEach(a => {
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
    .map(collection => {
      return async () => {
        await addDirect<any>(driver, socket, {
          collection: `${roomCollectionPrefix}-DATA-${collection}`,
          list: listMap[collection]
        })
      };
    })
    .reduce((prev, curr) => prev.then(curr), Promise.resolve());
}

const resist: Resister = (driver: Driver, socket: any): void => {
  setEvent<RequestType, ResponseType>(driver, socket, eventName, (driver: Driver, arg: RequestType) => importData(driver, socket, arg));
};
export default resist;
