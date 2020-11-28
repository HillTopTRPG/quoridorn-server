import Driver from "nekostore/lib/Driver";
import {findSingle} from "./collection";

export async function addActorGroup(
  driver: Driver,
  roomCollectionPrefix: string,
  groupName: string,
  key: string,
  type: "user" | "actor",
  userKey: string | null
): Promise<void> {
  const groupDoc = await findSingle<StoreData<ActorGroupStore>>(
    driver,
    `${roomCollectionPrefix}-DATA-actor-group-list`,
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

export async function deleteActorGroup(
  driver: Driver,
  roomCollectionPrefix: string,
  groupName: string,
  actorKey: string
): Promise<void> {
  const actorGroupCollectionName = `${roomCollectionPrefix}-DATA-actor-group-list`;
  const actorGroupCollection = driver.collection<StoreData<ActorGroupStore>>(actorGroupCollectionName);

  const groupDoc = (await actorGroupCollection.where("data.name", "==", groupName).get()).docs[0];
  const data: ActorGroupStore = groupDoc.data!.data!;
  const idx = data.list.findIndex(l => l.actorKey === actorKey);
  data.list.splice(idx, 1);

  await groupDoc.ref.update({ data });
}
