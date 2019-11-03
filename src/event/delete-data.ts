import {StoreObj} from "../@types/store";
import {Resister} from "../server";
import {getData, setEvent} from "./common";
import Driver from "nekostore/lib/Driver";
import DocumentSnapshot from "nekostore/lib/DocumentSnapshot";
import {ApplicationError} from "../error/ApplicationError";
import {DeleteDataRequest} from "../@types/data";
import {releaseTouchData} from "./release-touch-data";

// インタフェース
const eventName = "delete-data";
type RequestType = DeleteDataRequest;
type ResponseType = void;

/**
 * データ削除処理
 * @param driver
 * @param exclusionOwner
 * @param arg
 */
async function deleteData(driver: Driver, exclusionOwner: string, arg: RequestType): Promise<ResponseType> {
  // タッチ解除
  await releaseTouchData(driver, exclusionOwner, arg, true);

  // 部屋一覧の更新
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

  const data = docSnap.data;
  if (!data || !data.data)
    throw new ApplicationError(`Already deleted data error. id=${arg.id}`);

  await docSnap.ref.delete();
}

const resist: Resister = (driver: Driver, socket: any): void => {
  setEvent<RequestType, ResponseType>(driver, socket, eventName, (driver: Driver, arg: RequestType) => deleteData(driver, socket.id, arg));
};
export default resist;
