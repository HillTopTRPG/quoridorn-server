import Driver from "nekostore/lib/Driver";
import {StoreObj} from "../@types/store";
import {ActorGroup} from "../@types/data";

export async function addActorGroup(
  driver: Driver,
  roomCollectionPrefix: string,
  groupName: string,
  id: string,
  type: "user" | "other",
  userId: string | null
): Promise<void> {
  const actorGroupCollectionName = `${roomCollectionPrefix}-DATA-actor-group-list`;
  const actorGroupCollection = driver.collection<StoreObj<ActorGroup>>(actorGroupCollectionName);

  const groupDoc = (await actorGroupCollection.where("data.name", "==", groupName).get()).docs[0];
  const data: ActorGroup = groupDoc.data!.data!;
  data.list.push({ id, type, userId });

  await groupDoc.ref.update({ data });
}
