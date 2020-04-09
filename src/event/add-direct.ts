import {StoreObj} from "../@types/store";
import {PERMISSION_DEFAULT, Resister} from "../server";
import {getMaxOrder, getOwner, notifyProgress, registCollectionName, setEvent} from "./common";
import Driver from "nekostore/lib/Driver";
import {ApplicationError} from "../error/ApplicationError";
import {AddDirectRequest} from "../@types/socket";
import DocumentReference from "nekostore/src/DocumentReference";

// インタフェース
const eventName = "add-direct";
type RequestType = AddDirectRequest;
type ResponseType = string[];

/**
 * データ作成処理
 * @param driver
 * @param socket
 * @param arg
 */
async function addDirect(driver: Driver, socket: any, arg: RequestType): Promise<ResponseType> {
  const exclusionOwner: string = socket.id;
  const { c, maxOrder } = await getMaxOrder<any>(driver, arg.collection);
  let startOrder = maxOrder + 1;

  const docIdList: string[] = [];

  const addFunc = async (data: any, current: number): Promise<void> => {
    const option = arg.optionList && arg.optionList[current];
    const ownerType = option ? option.ownerType || null : "user";
    const owner = await getOwner(driver, exclusionOwner, option && option.owner || undefined);
    const permission = option && option.permission || PERMISSION_DEFAULT;
    const order = option && option.order !== undefined ? option.order : startOrder++;

    // 進捗報告
    notifyProgress(socket, arg.dataList.length, current);
    const addInfo: StoreObj<any> = {
      ownerType,
      owner,
      order,
      exclusionOwner: null,
      lastExclusionOwner: null,
      status: "added",
      createTime: new Date(),
      updateTime: new Date(),
      permission,
      data
    };
    try {
      const docRef: DocumentReference<any> = await c.add(addInfo);
      docIdList.push(docRef.id);
    } catch (err) {
      throw new ApplicationError(`Failure add doc.`, addInfo);
    }
  };

  // collectionの記録
  await registCollectionName(driver, arg.collection);

  // 直列の非同期で全部実行する
  await arg.dataList
    .map((data: any, idx: number) => () => addFunc(data, idx))
    .reduce((prev, curr) => prev.then(curr), Promise.resolve());

  // 進捗報告
  notifyProgress(socket, arg.dataList.length, arg.dataList.length);

  return docIdList;
}

const resist: Resister = (driver: Driver, socket: any): void => {
  setEvent<RequestType, ResponseType>(driver, socket, eventName, (driver: Driver, arg: RequestType) => addDirect(driver, socket, arg));
};
export default resist;
