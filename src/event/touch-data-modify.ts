import {Resister} from "../server";
import {ApplicationError} from "../error/ApplicationError";
import {addTouchier, getData, setEvent} from "./common";
import Driver from "nekostore/lib/Driver";
import {TouchModifyRequest} from "../@types/data";

// インタフェース
const eventName = "touch-data-modify";
type RequestType = TouchModifyRequest;
type ResponseType = string;

/**
 * データ（編集・削除）着手リクエスト
 * @param driver
 * @param exclusionOwner
 * @param arg
 */
export async function touchDataModify(driver: Driver, exclusionOwner: string, arg: RequestType): Promise<ResponseType> {
  console.log(`START [touchDataModify (${exclusionOwner})] collection=${arg.collection}, id=${arg.id}`);

  let docSnap;
  try {
    docSnap = await getData(driver, arg.collection, arg.id);
  } catch (err) {
    console.log(`ERROR [touchDataModify (${exclusionOwner})] collection=${arg.collection}, id=${arg.id}`);
    throw err;
  }

  if (!docSnap || !docSnap.exists()) {
    console.log(`ERROR [touchDataModify (${exclusionOwner})] collection=${arg.collection}, id=${arg.id}`);
    throw new ApplicationError(`[touchDataModify] No such data. collection=${arg.collection} id=${arg.id}`);
  }
  if (docSnap.data.exclusionOwner) {
    console.log(`ERROR [touchDataModify (${exclusionOwner})] collection=${arg.collection}, id=${arg.id}`);
    throw new ApplicationError(`Other player touched. id=${arg.id}`);
  }

  try {
    await docSnap.ref.update({
      exclusionOwner,
      status: "modify-touched",
      updateTime: new Date()
    });
  } catch (err) {
    console.log(`ERROR [touchDataModify (${exclusionOwner})] collection=${arg.collection}, id=${arg.id}`);
  }

  try {
    await addTouchier(driver, exclusionOwner, arg.collection, docSnap.ref.id);
  } catch (err) {
    console.log(`ERROR [touchDataModify (${exclusionOwner})] collection=${arg.collection}, id=${arg.id}`);
  }

  console.log(`END [touchDataModify (${exclusionOwner})] collection=${arg.collection}, id=${arg.id}`);
  return docSnap.ref.id;
}

const resist: Resister = (driver: Driver, socket: any): void => {
  setEvent<RequestType, ResponseType>(driver, socket, eventName, (driver: Driver, arg: RequestType) => touchDataModify(driver, socket.id, arg));
};
export default resist;
