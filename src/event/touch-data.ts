import {StoreObj} from "../@types/store";
import {DEFAULT_PERMISSION, Resister} from "../server";
import {addTouchier, getMaxOrder, getOwner, setEvent} from "./common";
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
  const { c, maxOrder } = await getMaxOrder<any>(driver, arg.collection);
  const order = maxOrder + 1;

  const owner = await getOwner(driver, exclusionOwner, arg.option ? arg.option.owner || undefined : undefined);

  const addInfo: StoreObj<any> = {
    order,
    exclusionOwner,
    lastExclusionOwner: exclusionOwner,
    owner,
    status: "initial-touched",
    createTime: new Date(),
    updateTime: null,
    permission: arg.option && arg.option.permission || DEFAULT_PERMISSION
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
