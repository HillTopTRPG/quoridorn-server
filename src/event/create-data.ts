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
type ResponseType = string;

/**
 * データ作成処理
 * @param driver
 * @param exclusionOwner
 * @param arg
 */
async function createData(driver: Driver, exclusionOwner: string, arg: RequestType): Promise<ResponseType> {
  console.log(`START [createData (${exclusionOwner})] collection=${arg.collection}, id=${arg.id}`);

  // タッチ解除
  try {
    await releaseTouchData(driver, exclusionOwner, arg, true);
  } catch (err) {
    console.log(`ERROR [createData (${exclusionOwner})] collection=${arg.collection}, id=${arg.id}`);
    throw err;
  }

  // データの更新
  const docSnap: DocumentSnapshot<StoreObj<any>> = await getData(
    driver,
    arg.collection,
    arg.id
  );

  if (!docSnap || !docSnap.exists()) {
    console.log(`ERROR [createData (${exclusionOwner})] collection=${arg.collection}, id=${arg.id}`);
    throw new ApplicationError(`Untouched data error. id=${arg.id}`);
  }

  if (docSnap.data.data) {
    console.log(`ERROR [createData (${exclusionOwner})] collection=${arg.collection}, id=${arg.id}`);
    throw new ApplicationError(`Already created data error. id=${arg.id}`);
  }

  try {
    await docSnap.ref.update({
      data: arg.data,
      status: "added",
      updateTime: new Date()
    });
  } catch (err) {
    console.log(`ERROR [createData (${exclusionOwner})] collection=${arg.collection}, id=${arg.id}`);
    throw err;
  }

  console.log(`END [createData (${exclusionOwner})] collection=${arg.collection}, id=${arg.id}`);
  return docSnap.ref.id;
}

const resist: Resister = (driver: Driver, socket: any): void => {
  setEvent<RequestType, ResponseType>(driver, socket, eventName, (driver: Driver, arg: RequestType) => createData(driver, socket.id, arg));
};
export default resist;
