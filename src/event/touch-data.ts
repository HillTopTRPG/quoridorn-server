import {StoreObj} from "../@types/store";
import {Resister} from "../server";
import {addTouchier, setEvent} from "./common";
import Driver from "nekostore/lib/Driver";
import {TouchRequest} from "../@types/data";
import {ApplicationError} from "../error/ApplicationError";

// インタフェース
const eventName = "touch-data";
type RequestType = TouchRequest;
type ResponseType = string;

/**
 * データ（作成）着手リクエスト
 * @param driver
 * @param exclusionOwner
 * @param arg 部屋番号
 */
async function touchData(driver: Driver, exclusionOwner: string, arg: RequestType): Promise<ResponseType> {
  console.log(`START [touchData (${exclusionOwner})] collection=${arg.collection}, id=${arg.id}`);

  const c = await driver.collection<StoreObj<any>>(arg.collection);
  let maxOrder: number;
  const docs = (await c
    .orderBy("order", "desc")
    .get())
    .docs
    .filter(doc => doc && doc.exists());
  if (!docs.length) {
    maxOrder = -1;
  } else {
    maxOrder = docs[0].data!.order;
  }
  const order = maxOrder + 1;

  let docRef;
  if (!arg.id) {
    docRef = await c.add({
      order,
      exclusionOwner,
      status: "initial-touched",
      createTime: new Date(),
      updateTime: null
    });
  } else {
    docRef = c.doc(arg.id);
    if ((await docRef.get()).exists()) {
      console.log(`ERROR [touchData (${exclusionOwner})] collection=${arg.collection}, id=${arg.id}`);
      throw new ApplicationError(`Data exists at touch-data by id. id=${arg.id}`);
    }

    try {
      await docRef.set({
        order,
        exclusionOwner,
        status: "initial-touched",
        createTime: new Date(),
        updateTime: null
      });
    } catch (err) {
      console.log(`ERROR [touchData (${exclusionOwner})] collection=${arg.collection}, id=${arg.id}`);
      throw err;
    }
  }

  try {
    await addTouchier(driver, exclusionOwner, arg.collection, docRef.id);
  } catch (err) {
    console.log(`ERROR [touchData (${exclusionOwner})] collection=${arg.collection}, id=${arg.id}`);
    throw err;
  }

  console.log(`END [touchData (${exclusionOwner})] collection=${arg.collection}, id=${arg.id}`);
  return docRef.id;
}

const resist: Resister = (driver: Driver, socket: any): void => {
  setEvent<RequestType, ResponseType>(driver, socket, eventName, (driver: Driver, arg: RequestType) => touchData(driver, socket.id, arg));
};
export default resist;
