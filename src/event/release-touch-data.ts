import {Resister} from "../server";
import {ApplicationError} from "../error/ApplicationError";
import {deleteTouchier, getData, setEvent} from "./common";
import Driver from "nekostore/lib/Driver";
import {ReleaseTouchDataRequest} from "../@types/socket";

// インタフェース
const eventName = "release-touch-data";
type RequestType = ReleaseTouchDataRequest;
type ResponseType = void;

/**
 * データ（作成・編集・削除）キャンセル処理
 * @param driver
 * @param exclusionOwner
 * @param arg
 * @param updateForce
 */
export async function releaseTouchData(driver: Driver, exclusionOwner: string, arg: RequestType, updateForce?: boolean): Promise<ResponseType> {
  const docSnap = await getData(driver, arg.collection, arg.id, { exclusionOwner });

  const createThrowDetail = (detail: string) => updateForce ? `Failure releaseTouchData. (${detail})` : detail;

  if (!docSnap) throw new ApplicationError(createThrowDetail("Already released touch or created."), arg);

  // 続けて更新する場合は排他制御情報をリセットしない
  if (arg.continuous) return;

  await deleteTouchier(driver, exclusionOwner, arg.collection, docSnap.ref.id);

  if (updateForce || docSnap.data!.data) {
    const updateInfo = {
      exclusionOwner: null,
      updateTime: new Date()
    };
    try {
      await docSnap.ref.update(updateInfo);
    } catch (err) {
      throw new ApplicationError(createThrowDetail("Failure update doc."), updateInfo);
    }
  } else {
    try {
      await docSnap.ref.delete();
    } catch (err) {
      throw new ApplicationError(createThrowDetail("Failure delete doc."), arg);
    }
  }
}

const resist: Resister = (driver: Driver, socket: any): void => {
  setEvent<RequestType, ResponseType>(driver, socket, eventName, (driver: Driver, arg: RequestType) => releaseTouchData(driver, socket.id, arg));
};
export default resist;
