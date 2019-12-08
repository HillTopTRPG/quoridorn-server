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
  console.log(`START [deleteData (${exclusionOwner})] collection=${arg.collection}, id=${arg.id}`);

  // タッチ解除
  try {
    await releaseTouchData(driver, exclusionOwner, arg, true);
  } catch (err) {
    console.log(`ERROR [deleteData (${exclusionOwner})] collection=${arg.collection}, id=${arg.id}`);
    throw err;
  }

  // 部屋一覧の更新
  let docSnap: DocumentSnapshot<StoreObj<any>>;

  try {
    docSnap = await getData(
      driver,
      arg.collection,
      arg.id
    );
  } catch (err) {
    console.log(`ERROR [deleteData (${exclusionOwner})] collection=${arg.collection}, id=${arg.id}`);
    throw err;
  }

  if (!docSnap || !docSnap.exists()) {
    console.log(`ERROR [deleteData (${exclusionOwner})] collection=${arg.collection}, id=${arg.id}`);
    throw new ApplicationError(`Untouched data error. id=${arg.id}`);
  }

  const data = docSnap.data;
  if (!data || !data.data) {
    console.log(`ERROR [deleteData (${exclusionOwner})] collection=${arg.collection}, id=${arg.id}`);
    throw new ApplicationError(`Already deleted data error. id=${arg.id}`);
  }

  try {
    await docSnap.ref.delete();
  } catch (err) {
    console.log(`ERROR [deleteData (${exclusionOwner})] collection=${arg.collection}, id=${arg.id}`);
    throw err;
  }

  console.log(`END [deleteData (${exclusionOwner})] collection=${arg.collection}, id=${arg.id}`);
}

const resist: Resister = (driver: Driver, socket: any): void => {
  setEvent<RequestType, ResponseType>(driver, socket, eventName, (driver: Driver, arg: RequestType) => deleteData(driver, socket.id, arg));
};
export default resist;
