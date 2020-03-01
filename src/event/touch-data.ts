import {StoreObj} from "../@types/store";
import {DEFAULT_PERMISSION, Resister} from "../server";
import {addTouchier, getDbMaxOrder, getDbOrder, setEvent} from "./common";
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
  const { c, maxOrder } = await getDbMaxOrder(driver, arg.collection);
  const order = maxOrder + 1;

  const owner = await getDbOrder(driver, exclusionOwner, arg.owner);

  const addInfo: StoreObj<any> = {
    order,
    exclusionOwner,
    lastExclusionOwner: exclusionOwner,
    owner,
    status: "initial-touched",
    createTime: new Date(),
    updateTime: null,
    permission: arg.permission || DEFAULT_PERMISSION
  };

  let docRef;
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
