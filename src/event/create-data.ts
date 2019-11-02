import {StoreObj} from "../@types/store";
import {Resister} from "../server";
import {getData, setEvent} from "./common";
import Driver from "nekostore/lib/Driver";
import DocumentSnapshot from "nekostore/lib/DocumentSnapshot";
import {ApplicationError} from "../error/ApplicationError";
import {releaseTouchData} from "./release-touch-data";
import {CreateDataRequest} from "../@types/data";

// インタフェース
const eventName = "create-data";
type RequestType = CreateDataRequest;
type ResponseType = void;

/**
 * データ作成処理
 * @param driver
 * @param exclusionOwner
 * @param arg
 */
async function createData(driver: Driver, exclusionOwner: string, arg: RequestType): Promise<ResponseType> {
  // タッチ解除
  await releaseTouchData(driver, exclusionOwner, arg, true);

  // データの更新
  const docSnap: DocumentSnapshot<StoreObj<any>> = await getData(
    driver,
    arg.collection,
    arg.id,
    {
      exclusionOwner
    }
  );

  if (!docSnap || !docSnap.exists())
    throw new ApplicationError(`Untouched data error. id=${arg.id}`);

  if (docSnap.data.data)
    throw new ApplicationError(`Already created data error. id=${arg.id}`);

  await docSnap.ref.update({
    data: arg.data,
    updateTime: new Date()
  });
}

const resist: Resister = (driver: Driver, socket: any): void => {
  setEvent<RequestType, ResponseType>(driver, socket, eventName, (driver: Driver, arg: RequestType) => createData(driver, socket.id, arg));
};
export default resist;
