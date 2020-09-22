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

  const list: StoreObj<any>[] = arg;

  // const listTable: { [collection: string]: StoreObj<any>[] } = {};
  const listMap: {
    [collection: string]: {
      dataList: any[];
      optionList: Partial<StoreObj<any>>[];
    }
  } = {};
  const total = list.length;

  arg.forEach(a => {
    const listMapElm = listMap[a.collection];
    if (listMapElm) {
      listMapElm.dataList.push(a.data);
      listMapElm.optionList.push({
        collection: a.collection,
        ownerType: a.ownerType,
        owner: a.owner,
        order: a.order,
        permission: a.permission
      });
    } else {
      listMap[a.collection] = {
        dataList: [a.data!],
        optionList: [{
          key: a.key,
          collection: a.collection,
          ownerType: a.ownerType,
          owner: a.owner,
          order: a.order,
          permission: a.permission
        }]
      }
    }
  });

  await Object.keys(listMap)
    .map(collection => {
      const {dataList, optionList} = listMap[collection];
      return async () => {
        await addDirect<any>(driver, socket, {
          collection: `${roomCollectionPrefix}-DATA-${collection}`,
          dataList,
          optionList
        })
      };
    })
    .reduce((prev, curr) => prev.then(curr), Promise.resolve());

  // const table: {
  //   cc: CollectionReference<StoreObj<any>>;
  //   id: string;
  //   data: StoreObj<any>;
  // }[] = [];
  // Object.keys(listTable).forEach(collection => {
  //   const collectionName = `${roomCollectionPrefix}-DATA-${collection}`;
  //   const cc = driver.collection<StoreObj<any>>(collectionName);
  //   listTable[collection].forEach(l => {
  //     const data: StoreObj<any> = {
  //       collection,
  //       ownerType: l.ownerType,
  //       owner: l.owner,
  //       order: l.order,
  //       exclusionOwner: null,
  //       lastExclusionOwner: null,
  //       permission: l.permission,
  //       status: "added",
  //       createTime: new Date(),
  //       updateTime: new Date(),
  //       data: l.data
  //     };
  //     table.push({ cc, id: l.id!, data });
  //   });
  // });
  //
  // const registFunc = async (
  //   cc: CollectionReference<StoreObj<any>>,
  //   id: string,
  //   data: StoreObj<any>,
  //   idx: number
  // ): Promise<void> => {
  //   notifyProgress(socket, total, idx);
  //   const docRef: DocumentReference<any> = cc.doc(id);
  //   await docRef.set(data);
  // };
  //
  // // 直列の非同期で全部実行する
  // await table
  //   .map((info, idx) => () => registFunc(info.cc, info.id, info.data, idx))
  //   .reduce((prev, curr) => prev.then(curr), Promise.resolve());
}

const resist: Resister = (driver: Driver, socket: any): void => {
  setEvent<RequestType, ResponseType>(driver, socket, eventName, (driver: Driver, arg: RequestType) => importData(driver, socket, arg));
};
export default resist;
