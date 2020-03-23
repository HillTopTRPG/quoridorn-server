import {StoreObj} from "../@types/store";
import {Resister} from "../server";
import {addActorGroup, additionalStatus, getData, getSocketDocSnap, setEvent} from "./common";
import Driver from "nekostore/lib/Driver";
import DocumentSnapshot from "nekostore/lib/DocumentSnapshot";
import {ApplicationError} from "../error/ApplicationError";
import {releaseTouchData} from "./release-touch-data";
import {CreateDataRequest} from "../@types/socket";
import {ActorStore} from "../@types/data";

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
  const roomCollectionPrefix = arg.collection.replace(/DATA-.+$/, "");

  // タッチ解除
  await releaseTouchData(driver, exclusionOwner, arg, true);

  // データの更新
  const docSnap: DocumentSnapshot<StoreObj<any>> | null = await getData(
    driver,
    arg.collection,
    arg.id
  );

  // Untouched check.
  if (!docSnap || !docSnap.exists()) throw new ApplicationError(`Untouched data.`, arg);

  // Already check.
  if (docSnap.data.data) throw new ApplicationError(`Already created.`, arg);

  const socketSnap = await getSocketDocSnap(driver, exclusionOwner);

  if (arg.collection.endsWith("DATA-actor-list")) {
    const data = arg.data as ActorStore;

    // アクターにはデフォルトステータスを登録する
    data.statusId = await additionalStatus(driver, roomCollectionPrefix, arg.id);

    // アクターグループ「All」に追加
    await addActorGroup(driver, roomCollectionPrefix, arg.id, "other", null, "All");
  }

  try {
    await docSnap.ref.update({
      data: arg.data,
      status: "added",
      owner: arg.option && arg.option.owner || socketSnap.data!.userId!,
      permission: arg.option && arg.option.permission || undefined,
      updateTime: new Date()
    });
  } catch (err) {
    throw new ApplicationError(`Failure update doc.`, arg);
  }

  return docSnap.ref.id;
}

const resist: Resister = (driver: Driver, socket: any): void => {
  setEvent<RequestType, ResponseType>(driver, socket, eventName, (driver: Driver, arg: RequestType) => createData(driver, socket.id, arg));
};
export default resist;
