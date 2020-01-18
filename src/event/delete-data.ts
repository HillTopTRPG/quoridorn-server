import {StoreObj} from "../@types/store";
import {Resister} from "../server";
import {getData, setEvent} from "./common";
import Driver from "nekostore/lib/Driver";
import DocumentSnapshot from "nekostore/lib/DocumentSnapshot";
import {ApplicationError} from "../error/ApplicationError";
import {DeleteDataRequest} from "../@types/socket";
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
  const docSnap: DocumentSnapshot<StoreObj<any>> | null = await getData(
    driver,
    arg.collection,
    arg.id
  );

  // Untouched check.
  if (!docSnap || !docSnap.exists()) throw new ApplicationError(`Untouched data.`, arg);

  // Already check.
  const data = docSnap.data;
  if (!data || !data.data) throw new ApplicationError(`Already deleted.`, arg);

  try {
    await docSnap.ref.delete();
  } catch (err) {
    throw new ApplicationError(`Failure delete doc.`, arg);
  }
}

const resist: Resister = (driver: Driver, socket: any): void => {
  setEvent<RequestType, ResponseType>(driver, socket, eventName, (driver: Driver, arg: RequestType) => deleteData(driver, socket.id, arg));
};
export default resist;
