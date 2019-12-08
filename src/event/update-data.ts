import {Resister} from "../server";
import {ApplicationError} from "../error/ApplicationError";
import {getData, setEvent} from "./common";
import Driver from "nekostore/lib/Driver";
import {UpdateDataRequest} from "../@types/data";
import {releaseTouchData} from "./release-touch-data";

// インタフェース
const eventName = "update-data";
type RequestType = UpdateDataRequest;
type ResponseType = void;

/**
 * データ（編集・削除）着手リクエスト
 * @param driver
 * @param exclusionOwner
 * @param arg
 */
export async function updateData(driver: Driver, exclusionOwner: string, arg: RequestType): Promise<ResponseType> {
  console.log(`START [updateData (${exclusionOwner})] collection=${arg.collection}, id=${arg.id}`);

  // タッチ解除
  try {
    await releaseTouchData(driver, exclusionOwner, arg, true);
  } catch (err) {
    console.log(`ERROR [updateData (${exclusionOwner})] collection=${arg.collection}, id=${arg.id}`);
    throw err;
  }

  let docSnap;
  try {
    docSnap = await getData(driver, arg.collection, arg.id);
  } catch (err) {
    console.log(`ERROR [updateData (${exclusionOwner})] collection=${arg.collection}, id=${arg.id}`);
    throw err;
  }

  if (!docSnap || !docSnap.exists() || !docSnap.data.data) {
    console.log(`ERROR [updateData (${exclusionOwner})] collection=${arg.collection}, id=${arg.id}`);
    throw new ApplicationError(`[updateData] No such data. collection=${arg.collection} id=${arg.id}`);
  }

  try {
    await docSnap.ref.update({
      data: arg.data,
      status: "modified",
      updateTime: new Date()
    });
  } catch (err) {
    console.log(`ERROR [updateData (${exclusionOwner})] collection=${arg.collection}, id=${arg.id}`);
    throw err;
  }

  console.log(`END [updateData (${exclusionOwner})] collection=${arg.collection}, id=${arg.id}`);
}

const resist: Resister = (driver: Driver, socket: any): void => {
  setEvent<RequestType, ResponseType>(driver, socket, eventName, (driver: Driver, arg: RequestType) => updateData(driver, socket.id, arg));
};
export default resist;
