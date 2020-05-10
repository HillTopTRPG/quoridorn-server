import {StoreObj} from "../@types/store";
import {Resister} from "../server";
import {addActorGroup, additionalStatus, getData, getSocketDocSnap, procAsyncSplit, setEvent} from "./common";
import Driver from "nekostore/lib/Driver";
import DocumentSnapshot from "nekostore/lib/DocumentSnapshot";
import {ApplicationError} from "../error/ApplicationError";
import {releaseTouchData} from "./release-touch-data";
import {CreateDataRequest} from "../@types/socket";
import {ActorStore} from "../@types/data";

// インタフェース
const eventName = "create-data";
type RequestType = CreateDataRequest;
type ResponseType = string[];

/**
 * データ作成処理
 * @param driver
 * @param exclusionOwner
 * @param arg
 */
async function createData(driver: Driver, exclusionOwner: string, arg: RequestType): Promise<ResponseType> {
  // タッチ解除
  await releaseTouchData(driver, exclusionOwner, arg, true);
  const resultIdList: string[] = [];

  await procAsyncSplit(arg.idList.map((id: string, idx: number) => singleReleaseCreateData(
    driver,
    exclusionOwner,
    arg.collection,
    id,
    arg.dataList[idx],
    resultIdList,
    arg.optionList ? arg.optionList[idx] : undefined
  )));

  return resultIdList;
}

async function singleReleaseCreateData(
  driver: Driver,
  exclusionOwner: string,
  collection: string,
  id: string,
  data: any,
  resultIdList: string[],
  option?: Partial<StoreObj<unknown>> & { continuous?: boolean }
): Promise<void> {
  const msgArg = { collection, id, option };
  const roomCollectionPrefix = collection.replace(/-DATA-.+$/, "");

  // データの更新
  const docSnap: DocumentSnapshot<StoreObj<any>> | null = await getData(
    driver,
    collection,
    id
  );

  // Untouched check.
  if (!docSnap || !docSnap.exists()) throw new ApplicationError(`Untouched data.`, msgArg);

  // Already check.
  if (docSnap.data.data) throw new ApplicationError(`Already created.`, msgArg);

  const socketSnap = await getSocketDocSnap(driver, exclusionOwner);

  if (collection.endsWith("DATA-actor-list")) {
    // アクターにはデフォルトステータスを登録する
    (data as ActorStore).statusId = await additionalStatus(driver, roomCollectionPrefix, id);

    // アクターグループ「All」に追加
    await addActorGroup(driver, roomCollectionPrefix, id, "other", null, "All");
  }

  try {
    await docSnap.ref.update({
      data,
      status: "added",
      owner: option && option.owner || socketSnap.data!.userId!,
      permission: option && option.permission || undefined,
      updateTime: new Date()
    });
  } catch (err) {
    throw new ApplicationError(`Failure update doc.`, msgArg);
  }

  resultIdList.push(docSnap.ref.id);
}

const resist: Resister = (driver: Driver, socket: any): void => {
  setEvent<RequestType, ResponseType>(driver, socket, eventName, (driver: Driver, arg: RequestType) => createData(driver, socket.id, arg));
};
export default resist;
