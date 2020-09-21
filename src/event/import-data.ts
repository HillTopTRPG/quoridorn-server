import {Resister} from "../server";
import Driver from "nekostore/lib/Driver";
import {SocketStore} from "../@types/data";
import {setEvent} from "../utility/server";
import {getSocketDocSnap} from "../utility/collection";
import {StoreMetaData, StoreObj} from "../@types/store";
import {addDirect} from "./add-direct";

// インタフェース
const eventName = "import-data";
type RequestType = (StoreObj<any> & StoreMetaData)[];
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

  const list: (StoreObj<any> & StoreMetaData)[] = arg;

  const listTable: { [collection: string]: (StoreObj<any> & StoreMetaData)[] } = {};
  const listMap: {
    [collection: string]: {
      dataList: any[];
      optionList: Partial<StoreObj<any>>[];
      idList: string[];
    }
  } = {};
  const total = list.length;

  arg.forEach(a => {
    const tableList = listTable[a.collection];
    if (tableList) {
      tableList.push(a);
      listMap[a.collection].idList.push(a.id!);
      listMap[a.collection].dataList.push(a.data);
      listMap[a.collection].optionList.push({
        collection: a.collection,
        ownerType: a.ownerType,
        owner: a.owner,
        order: a.order,
        permission: a.permission
      });
    } else {
      listTable[a.collection] = [a];
      listMap[a.collection] = {
        dataList: [a.data!],
        optionList: [{
          collection: a.collection,
          ownerType: a.ownerType,
          owner: a.owner,
          order: a.order,
          permission: a.permission
        }],
        idList: [a.id!]
      }
    }
  });

  await Object.keys(listMap)
    .map(collection => {
      const {dataList, optionList, idList} = listMap[collection];
      return async () => {
        await addDirect(driver, socket, {
          collection: `${roomCollectionPrefix}-DATA-${collection}`,
          dataList,
          optionList,
          idList
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
