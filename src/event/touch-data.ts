import {StoreObj} from "../@types/store";
import {Resister} from "../server";
import {addTouchier, setEvent} from "./common";
import Driver from "nekostore/lib/Driver";
import {TouchDataRequest} from "../@types/socket";
import {ApplicationError} from "../error/ApplicationError";

// インタフェース
const eventName = "touch-data";
type RequestType = TouchDataRequest;
type ResponseType = string;

/**
 * データ（作成）着手リクエスト
 * @param driver
 * @param exclusionOwner
 * @param arg 部屋番号
 */
async function touchData(driver: Driver, exclusionOwner: string, arg: RequestType): Promise<ResponseType> {
  const c = await driver.collection<StoreObj<any>>(arg.collection);

  const docs = (await c
    .orderBy("order", "desc")
    .get())
    .docs
    .filter(doc => doc && doc.exists());

  const order = (!docs.length ? -1 : docs[0].data!.order) + 1;

  let docRef;
  const addInfo: StoreObj<any> = {
    order,
    exclusionOwner,
    owner: null,
    status: "initial-touched",
    createTime: new Date(),
    updateTime: null,
    permission: {
      view: {
        type: "none",
        list: []
      },
      edit: {
        type: "none",
        list: []
      },
      chmod: {
        type: "none",
        list: []
      }
    }
  };
  if (!arg.id) {
    try {
      docRef = await c.add(addInfo);
    } catch (err) {
      throw new ApplicationError(`Failure add doc.`, addInfo);
    }
  } else {
    docRef = c.doc(arg.id);

    if ((await docRef.get()).exists()) throw new ApplicationError(`Already exists.`, arg);

    try {
      await docRef.set(addInfo);
    } catch (err) {
      throw new ApplicationError(`Failure set doc.`, addInfo);
    }
  }

  await addTouchier(driver, exclusionOwner, arg.collection, docRef.id);

  return docRef.id;
}

const resist: Resister = (driver: Driver, socket: any): void => {
  setEvent<RequestType, ResponseType>(driver, socket, eventName, (driver: Driver, arg: RequestType) => touchData(driver, socket.id, arg));
};
export default resist;
