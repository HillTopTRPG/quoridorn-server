import {StoreObj} from "../@types/store";
import {Resister} from "../server";
import {getData, getSocketDocSnap, setEvent} from "./common";
import Driver from "nekostore/lib/Driver";
import DocumentSnapshot from "nekostore/lib/DocumentSnapshot";
import {ApplicationError} from "../error/ApplicationError";
import {releaseTouchData} from "./release-touch-data";
import {CreateDataRequest} from "../@types/socket";
import {ActorGroup} from "../@types/data";

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

  try {
    await docSnap.ref.update({
      data: arg.data,
      status: "added",
      owner: socketSnap.data!.userId!,
      permission: arg.permission,
      updateTime: new Date()
    });
  } catch (err) {
    throw new ApplicationError(`Failure update doc.`, arg);
  }

  if (arg.collection.endsWith("DATA-character-list")) {
    // アクターグループ「All」に追加

    const actorGroupCollectionName = arg.collection.replace("DATA-character-list", "DATA-actor-group-list");
    const actorGroupCollection = driver.collection<StoreObj<ActorGroup>>(actorGroupCollectionName);

    // 新しいグループに追加
    const newGroupDoc = (await actorGroupCollection.where("name", "==", "All").get()).docs[0];
    const newGroupData: ActorGroup = newGroupDoc.data!.data!;
    newGroupData.list.push({
      type: "user",
      id: arg.id
    });
    await newGroupDoc.ref.update({
      data: newGroupData
    });
  }

  return docSnap.ref.id;
}

const resist: Resister = (driver: Driver, socket: any): void => {
  setEvent<RequestType, ResponseType>(driver, socket, eventName, (driver: Driver, arg: RequestType) => createData(driver, socket.id, arg));
};
export default resist;
