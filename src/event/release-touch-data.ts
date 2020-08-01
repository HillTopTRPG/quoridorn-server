import {Resister} from "../server";
import {ApplicationError} from "../error/ApplicationError";
import Driver from "nekostore/lib/Driver";
import {ReleaseTouchDataRequest} from "../@types/socket";
import {StoreObj} from "../@types/store";
import {getData} from "../utility/collection";
import {setEvent} from "../utility/server";
import {deleteTouchier} from "../utility/touch";
import {procAsyncSplit} from "../utility/async";

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
  await procAsyncSplit(arg.idList.map((id: string, idx: number) => singleReleaseTouchData(
    driver,
    exclusionOwner,
    arg.collection,
    id,
    arg.optionList ? (arg.optionList[idx] || undefined) : undefined,
    updateForce
  )));
}

async function singleReleaseTouchData(
  driver: Driver,
  exclusionOwner: string,
  collection: string,
  id: string,
  option?: Partial<StoreObj<unknown>> & { continuous?: boolean },
  updateForce?: boolean
): Promise<void> {
  const msgArg = { collection, id, option };
  const docSnap = await getData(driver, collection, id, { exclusionOwner });

  const createThrowDetail = (detail: string) => updateForce ? `Failure releaseTouchData. (${detail})` : detail;

  if (!docSnap) throw new ApplicationError(createThrowDetail("Already released touch or created."), msgArg);

  // 続けて更新する場合は排他制御情報をリセットしない
  if (option && option.continuous) return;

  const backupUpdateTime = await deleteTouchier(driver, exclusionOwner, collection, docSnap.ref.id);

  if (updateForce || docSnap.data!.data) {
    const updateInfo = {
      exclusionOwner: null,
      updateTime: backupUpdateTime
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
      throw new ApplicationError(createThrowDetail("Failure delete doc."), msgArg);
    }
  }
}

const resist: Resister = (driver: Driver, socket: any): void => {
  setEvent<RequestType, ResponseType>(driver, socket, eventName, (driver: Driver, arg: RequestType) => releaseTouchData(driver, socket.id, arg));
};
export default resist;
