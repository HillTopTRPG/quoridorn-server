import Driver from "nekostore/lib/Driver";
import {findSingle, splitCollectionName} from "./collection";
import {procAsyncSplit} from "./async";
import {deleteSimple, RelationalDataDeleter} from "./data";

export async function addAuthorityGroup(
  driver: Driver,
  roomCollectionPrefix: string,
  groupName: string,
  key: string,
  type: "user" | "actor",
  userKey: string
): Promise<void> {
  const groupDoc = await findSingle<StoreData<AuthorityGroupStore>>(
    driver,
    `${roomCollectionPrefix}-DATA-authority-group-list`,
    "data.name",
    groupName
  );
  const data = groupDoc!.data!.data!;

  if (data.list.some(
    l =>
      l.type === type &&
      l.actorKey === key &&
      l.userKey === userKey
  )) return;

  data.list.push({ type, actorKey: key, userKey });
  await groupDoc!.ref.update({ data });
}

export async function deleteAuthorityGroupRelation(
  driver: Driver,
  socket: any,
  collectionName: string,
  key: string
): Promise<void> {
  const {roomCollectionPrefix} = splitCollectionName(collectionName);
  const deleter: RelationalDataDeleter = new RelationalDataDeleter(driver, roomCollectionPrefix, key);

  // グループチャットタブを強制的に削除
  await deleter.deleteForce(
    "group-chat-tab-list",
    "data.authorityGroupKey"
  );

  // 最後に本体を削除
  await deleteSimple(driver, socket, collectionName, key);
}

export async function deleteAuthorityGroup(
  driver: Driver,
  roomCollectionPrefix: string,
  actorKey: string
): Promise<void> {
  const authorityGroupCollectionName = `${roomCollectionPrefix}-DATA-authority-group-list`;
  const authorityGroupCollection = driver.collection<StoreData<AuthorityGroupStore>>(authorityGroupCollectionName);

  const groupDocList = (await authorityGroupCollection.get()).docs;

  await procAsyncSplit(
    groupDocList
      .filter(
        ag => ag.data!.data!.list.some(gr => gr.actorKey === actorKey && gr.type === "actor")
      )
      .map(ag => {
        const data: AuthorityGroupStore = ag.data!.data!;
        const idx = data.list.findIndex(l => l.actorKey === actorKey);
        data.list.splice(idx, 1);
        return ag.ref.update({ data });
      })
  );
}
