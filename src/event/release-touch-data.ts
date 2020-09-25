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
type RequestType = ReleaseTouchDataRequest<any>;
type ResponseType = void;

/**
 * データ（作成・編集・削除）キャンセル処理
 * @param driver
 * @param exclusionOwner
 * @param arg
 * @param updateForce
 */
export async function releaseTouchData(driver: Driver, exclusionOwner: string, arg: RequestType, updateForce?: boolean): Promise<ResponseType> {
  await procAsyncSplit(arg.list.map(data => singleReleaseTouchData(
    driver,
    exclusionOwner,
    arg.collection,
    data,
    updateForce
  )));
}

async function singleReleaseTouchData<T>(
  driver: Driver,
  socketId: string,
  collection: string,
  data: Partial<StoreObj<T>> & { key: string; continuous?: boolean },
  updateForce?: boolean
): Promise<void> {
  const msgArg = { collection, data };
  const doc = await getData(driver, collection, { key: data.key });

  const createThrowDetail = (detail: string) =>
    updateForce ? `Failure releaseTouchData. (${detail})` : detail;

  if (!doc) throw new ApplicationError(createThrowDetail("Already released touch or created."), msgArg);

  // 続けて更新する場合は排他制御情報をリセットしない
  if (data.continuous) return;

  const backupUpdateTime = await deleteTouchier(driver, socketId, collection, doc.data!.key);

  if (updateForce || doc.data!.data) {
    const updateInfo = {
      exclusionOwner: null,
      updateTime: backupUpdateTime
    };
    try {
      await doc.ref.update(updateInfo);
    } catch (err) {
      throw new ApplicationError(createThrowDetail("Failure update doc."), updateInfo);
    }
  } else {
    try {
      await doc.ref.delete();
    } catch (err) {
      throw new ApplicationError(createThrowDetail("Failure delete doc."), msgArg);
    }
  }
}

const resist: Resister = (driver: Driver, socket: any): void => {
  setEvent<RequestType, ResponseType>(driver, socket, eventName, (driver: Driver, arg: RequestType) => releaseTouchData(driver, socket.id, arg));
};
export default resist;
