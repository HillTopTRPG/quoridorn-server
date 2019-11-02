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
  const docSnap = await getData(driver, arg.collection, arg.id, {
    exclusionOwner
  });
  if (!docSnap) throw new ApplicationError(`Already released touch or created data. id=${arg.id}`);
  await deleteTouchier(driver, exclusionOwner, arg.collection, docSnap.ref.id);
  if (updateForce || docSnap.data!.data) {
    await docSnap.ref.update({
      exclusionOwner: null,
      updateTime: new Date()
    });
  } else {
    await docSnap.ref.delete();
  }
}

const resist: Resister = (driver: Driver, socket: any): void => {
  setEvent<RequestType, ResponseType>(driver, socket, eventName, (driver: Driver, arg: RequestType) => releaseTouchData(driver, socket.id, arg));
};
export default resist;
