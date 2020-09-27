import Driver from "nekostore/lib/Driver";

export async function addActorGroup(
  driver: Driver,
  roomCollectionPrefix: string,
  groupName: string,
  key: string,
  type: "user" | "actor",
  userKey: string | null
): Promise<void> {
  const actorGroupCollectionName = `${roomCollectionPrefix}-DATA-actor-group-list`;
  const actorGroupCollection = driver.collection<StoreData<ActorGroupStore>>(actorGroupCollectionName);

  const groupDoc = (await actorGroupCollection.where("data.name", "==", groupName).get()).docs[0];
  const data: ActorGroupStore = groupDoc.data!.data!;
  data.list.push({ type, actorKey: key, userKey });

  await groupDoc.ref.update({ data });
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
