import Driver from "nekostore/lib/Driver";
import {findSingle} from "./collection";

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

export async function deleteAuthorityGroup(
  driver: Driver,
  roomCollectionPrefix: string,
  groupName: string,
  actorKey: string
): Promise<void> {
  const authorityGroupCollectionName = `${roomCollectionPrefix}-DATA-authority-group-list`;
  const authorityGroupCollection = driver.collection<StoreData<AuthorityGroupStore>>(authorityGroupCollectionName);

  const groupDoc = (await authorityGroupCollection.where("data.name", "==", groupName).get()).docs[0];
  const data: AuthorityGroupStore = groupDoc.data!.data!;
  const idx = data.list.findIndex(l => l.actorKey === actorKey);
  data.list.splice(idx, 1);

  await groupDoc.ref.update({ data });
}
