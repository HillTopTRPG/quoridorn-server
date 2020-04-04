import {Resister} from "../server";
import {ApplicationError} from "../error/ApplicationError";
import {addTouchier, getData, procAsyncSplit, setEvent} from "./common";
import Driver from "nekostore/lib/Driver";
import {StoreObj} from "../@types/store";
import {TouchModifyDataRequest} from "../@types/socket";

// インタフェース
const eventName = "touch-data-modify";
type RequestType = TouchModifyDataRequest;
type ResponseType = string[];

/**
 * データ（編集・削除）着手リクエスト
 * @param driver
 * @param exclusionOwner
 * @param arg
 */
export async function touchDataModify(driver: Driver, exclusionOwner: string, arg: RequestType): Promise<ResponseType> {
  const resultIdList: string[] = [];

  await procAsyncSplit(arg.idList.map((id: string) => singleTouchDataModify(
    driver,
    exclusionOwner,
    arg.collection,
    resultIdList,
    id
  )));

  return resultIdList;
}

async function singleTouchDataModify(
  driver: Driver,
  exclusionOwner: string,
  collection: string,
  resultIdList: string[],
  id: string
): Promise<void> {
  const msgArg = { collection, id };
  const docSnap = await getData(driver, collection, id);

  // No such check.
  if (!docSnap || !docSnap.exists()) throw new ApplicationError(`No such.`, msgArg);

  // Already check.
  if (docSnap.data.exclusionOwner) throw new ApplicationError(`Already touched.`, msgArg);

  const updateTime = docSnap.data.updateTime;

  const updateInfo: Partial<StoreObj<any>> = {
    exclusionOwner,
    lastExclusionOwner: exclusionOwner,
    status: "modify-touched",
    updateTime: new Date()
  };
  try {
    await docSnap.ref.update(updateInfo);
  } catch (err) {
    throw new ApplicationError(`Failure update doc.`, updateInfo);
  }

  await addTouchier(driver, exclusionOwner, collection, docSnap.ref.id, updateTime);

  resultIdList.push(docSnap.ref.id);
}

const resist: Resister = (driver: Driver, socket: any): void => {
  setEvent<RequestType, ResponseType>(driver, socket, eventName, (driver: Driver, arg: RequestType) => touchDataModify(driver, socket.id, arg));
};
export default resist;
