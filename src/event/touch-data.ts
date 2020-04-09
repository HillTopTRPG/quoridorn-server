import {StoreObj} from "../@types/store";
import {PERMISSION_DEFAULT, Resister} from "../server";
import {addTouchier, getMaxOrder, getOwner, procAsyncSplit, registCollectionName, setEvent} from "./common";
import Driver from "nekostore/lib/Driver";
import {TouchDataRequest} from "../@types/socket";
import {ApplicationError} from "../error/ApplicationError";

// インタフェース
const eventName = "touch-data";
type RequestType = TouchDataRequest;
type ResponseType = string[];

/**
 * データ（作成）着手リクエスト
 * @param driver
 * @param exclusionOwner
 * @param arg 部屋番号
 */
async function touchData(driver: Driver, exclusionOwner: string, arg: RequestType): Promise<ResponseType> {
  const resultIdList: string[] = [];
  if (arg.idList) {
    await procAsyncSplit(arg.idList.map((id: string, idx: number) => singleTouchData(
      driver,
      exclusionOwner,
      arg.collection,
      resultIdList,
      id,
      arg.optionList ? (arg.optionList[idx] || undefined) : undefined
    )));
  } else {
    await singleTouchData(
      driver,
      exclusionOwner,
      arg.collection,
      resultIdList,
      undefined,
      arg.optionList ? (arg.optionList[0] || undefined) : undefined
    )
  }
  return resultIdList;
}

async function singleTouchData(
  driver: Driver,
  exclusionOwner: string,
  collection: string,
  resultIdList: string[],
  id?: string,
  option?: Partial<StoreObj<unknown>> & { continuous?: boolean }
): Promise<void> {
  const msgArg = {collection, id, option};

  const { c, maxOrder } = await getMaxOrder<any>(driver, collection);
  const order = maxOrder + 1;

  const ownerType = option ? option.ownerType || null : "user";
  const owner = await getOwner(driver, exclusionOwner, option ? option.owner : undefined);
  const permission = option && option.permission || PERMISSION_DEFAULT;

  const addInfo: StoreObj<any> = {
    ownerType,
    owner,
    order,
    exclusionOwner,
    lastExclusionOwner: exclusionOwner,
    status: "initial-touched",
    createTime: new Date(),
    updateTime: null,
    permission
  };

  let docRef;
  if (!id) {
    try {
      docRef = await c.add(addInfo);
    } catch (err) {
      throw new ApplicationError(`Failure add doc.`, addInfo);
    }
  } else {
    docRef = c.doc(id);

    if ((await docRef.get()).exists()) throw new ApplicationError(`Already exists.`, msgArg);

    try {
      await docRef.set(addInfo);
    } catch (err) {
      throw new ApplicationError(`Failure set doc.`, addInfo);
    }
  }

  // collectionの記録
  await registCollectionName(driver, collection);

  await addTouchier(driver, exclusionOwner, collection, docRef.id, null);

  resultIdList.push(docRef.id!);
}

const resist: Resister = (driver: Driver, socket: any): void => {
  setEvent<RequestType, ResponseType>(driver, socket, eventName, (driver: Driver, arg: RequestType) => touchData(driver, socket.id, arg));
};
export default resist;
