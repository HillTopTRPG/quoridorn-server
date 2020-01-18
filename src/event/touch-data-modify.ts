import {Resister} from "../server";
import {ApplicationError} from "../error/ApplicationError";
import {addTouchier, getData, setEvent} from "./common";
import Driver from "nekostore/lib/Driver";
import {StoreObj} from "../@types/store";
import {TouchModifyDataRequest} from "../@types/socket";

// インタフェース
const eventName = "touch-data-modify";
type RequestType = TouchModifyDataRequest;
type ResponseType = string;

/**
 * データ（編集・削除）着手リクエスト
 * @param driver
 * @param exclusionOwner
 * @param arg
 */
export async function touchDataModify(driver: Driver, exclusionOwner: string, arg: RequestType): Promise<ResponseType> {
  const docSnap = await getData(driver, arg.collection, arg.id);

  // No such check.
  if (!docSnap || !docSnap.exists()) throw new ApplicationError(`No such.`, arg);

  // Already check.
  if (docSnap.data.exclusionOwner) throw new ApplicationError(`Already touched.`, arg);

  const updateInfo: Partial<StoreObj<any>> = {
    exclusionOwner,
    status: "modify-touched",
    updateTime: new Date()
  };
  try {
    await docSnap.ref.update(updateInfo);
  } catch (err) {
    throw new ApplicationError(`Failure update doc.`, updateInfo);
  }

  await addTouchier(driver, exclusionOwner, arg.collection, docSnap.ref.id);

  return docSnap.ref.id;
}

const resist: Resister = (driver: Driver, socket: any): void => {
  setEvent<RequestType, ResponseType>(driver, socket, eventName, (driver: Driver, arg: RequestType) => touchDataModify(driver, socket.id, arg));
};
export default resist;
