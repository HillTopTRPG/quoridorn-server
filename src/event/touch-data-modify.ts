import {Resister} from "../server";
import {ApplicationError} from "../error/ApplicationError";
import Driver from "nekostore/lib/Driver";
import {TouchModifyDataRequest} from "../@types/socket";
import {getData} from "../utility/collection";
import {setEvent} from "../utility/server";
import {addTouchier} from "../utility/touch";
import {procAsyncSplit} from "../utility/async";

// インタフェース
const eventName = "touch-data-modify";
type RequestType = TouchModifyDataRequest<any>;
type ResponseType = string[];

/**
 * データ（編集・削除）着手リクエスト
 * @param driver
 * @param exclusionOwner
 * @param arg
 */
export async function touchDataModify(driver: Driver, exclusionOwner: string, arg: RequestType): Promise<ResponseType> {
  const resultKeyList: string[] = [];

  await procAsyncSplit(arg.list.map(option => singleTouchDataModify(
    driver,
    exclusionOwner,
    arg.collection,
    resultKeyList,
    option.key
  )));

  return resultKeyList;
}

async function singleTouchDataModify(
  driver: Driver,
  exclusionOwner: string,
  collection: string,
  resultKeyList: string[],
  key: string
): Promise<void> {
  const msgArg = { collection, key };
  const doc = await getData(driver, collection, { key });

  // No such check.
  if (!doc || !doc.exists()) throw new ApplicationError(`No such.`, msgArg);

  // Already check.
  if (doc.data.exclusionOwner) throw new ApplicationError(`Already touched.`, msgArg);

  const updateTime = doc.data.updateTime;

  const updateInfo: Partial<StoreData<any>> = {
    exclusionOwner,
    lastExclusionOwner: exclusionOwner,
    status: "modify-touched",
    updateTime: new Date()
  };
  try {
    await doc.ref.update(updateInfo);
  } catch (err) {
    throw new ApplicationError(`Failure update doc.`, updateInfo);
  }

  await addTouchier(driver, exclusionOwner, collection, key, updateTime);

  resultKeyList.push(key);
}

const resist: Resister = (driver: Driver, socket: any): void => {
  setEvent<RequestType, ResponseType>(driver, socket, eventName, (driver: Driver, arg: RequestType) => touchDataModify(driver, socket.id, arg));
};
export default resist;
