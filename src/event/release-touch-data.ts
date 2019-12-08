import {Resister} from "../server";
import {ApplicationError} from "../error/ApplicationError";
import {deleteTouchier, getData, setEvent} from "./common";
import Driver from "nekostore/lib/Driver";
import {ReleaseTouchRequest} from "../@types/data";

// インタフェース
const eventName = "release-touch-data";
type RequestType = ReleaseTouchRequest;
type ResponseType = void;

/**
 * データ（作成・編集・削除）キャンセル処理
 * @param driver
 * @param exclusionOwner
 * @param arg
 * @param updateForce
 */
export async function releaseTouchData(driver: Driver, exclusionOwner: string, arg: RequestType, updateForce?: boolean): Promise<ResponseType> {
  console.log(`START [releaseTouchData (${exclusionOwner}) collection=${arg.collection} id=${arg.id}`);

  let docSnap;
  try {
    docSnap = await getData(driver, arg.collection, arg.id, {
      exclusionOwner
    });
  } catch (err) {
    console.log(`ERROR [releaseTouchData (${exclusionOwner}) collection=${arg.collection} id=${arg.id}`);
    throw err;
  }

  if (!docSnap) {
    console.log(`ERROR [releaseTouchData (${exclusionOwner}) collection=${arg.collection} id=${arg.id}`);
    throw new ApplicationError(`Already released touch or created data. collection=${arg.collection} id=${arg.id} exclusionOwner=${exclusionOwner}`);
  }

  try {
    await deleteTouchier(driver, exclusionOwner, arg.collection, docSnap.ref.id);
  } catch (err) {
    console.log(`ERROR [releaseTouchData (${exclusionOwner}) collection=${arg.collection} id=${arg.id}`);
    throw err;
  }

  try {
    if (updateForce || docSnap.data!.data) {
      await docSnap.ref.update({
        exclusionOwner: null,
        updateTime: new Date()
      });
    } else {
      await docSnap.ref.delete();
    }
  } catch (err) {
    console.log(`ERROR [releaseTouchData (${exclusionOwner}) collection=${arg.collection} id=${arg.id}`);
    throw err;
  }

  console.log(`END [releaseTouchData (${exclusionOwner}) collection=${arg.collection} id=${arg.id}`);
}

const resist: Resister = (driver: Driver, socket: any): void => {
  setEvent<RequestType, ResponseType>(driver, socket, eventName, (driver: Driver, arg: RequestType) => releaseTouchData(driver, socket.id, arg));
};
export default resist;
