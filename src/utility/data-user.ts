import Driver from "nekostore/lib/Driver";
import {UserLoginResponse, UserType} from "../@types/socket";
import {hash} from "./password";
import {hashAlgorithm} from "../server";
import {getSocketDocSnap} from "./collection";
import {addActorGroup} from "./data-actor-group";
import {addActorRelation} from "./data-actor";
import uuid = require("uuid");
import {StoreObj} from "../@types/store";
import DocumentReference from "nekostore/lib/DocumentReference";
import {ChatPaletteStore, UserStore} from "../@types/data";
import {addDirect} from "../event/add-direct";
import {addSimple} from "./data";

export async function addUser(
  driver: Driver,
  socket: any,
  roomCollectionPrefix: string,
  name: string,
  password: string,
  type: UserType
): Promise<UserLoginResponse> {
  const userListCCName = `${roomCollectionPrefix}-DATA-user-list`;

  password = await hash(password, hashAlgorithm);

  const token = uuid.v4();

  const userId = (await addDirect(driver, socket, {
    collection: userListCCName,
    dataList: [{ name, password, token, type, login: 1 }],
    optionList: [{ ownerType: null, owner: null, order: -1 }]
  }, false))[0];

  return {
    userId,
    token
  };
}

export async function addUserRelation(
  driver: Driver,
  socket: any,
  collectionName: string,
  user: UserStore,
  option?: Partial<StoreObj<UserStore>>
): Promise<DocumentReference<StoreObj<UserStore>>> {
  const roomCollectionPrefix = collectionName.replace(/-DATA-.+$/, "");
  const docRef = await addSimple(driver, socket, collectionName, user, option);
  const userId = docRef.id;

  const socketDocSnap = (await getSocketDocSnap(driver, socket.id));

  await socketDocSnap.ref.update({
    userId
  });

  const actorId: string = (await addActorRelation(
    driver,
    socket,
    `${roomCollectionPrefix}-DATA-actor-list`,
    {
      name: user.name,
      type: "user",
      chatFontColorType: "original",
      chatFontColor: "#000000",
      standImagePosition: 1
    }
  )).id;

  const fixedAddActorGroup = async (groupName: string) => {
    await addActorGroup(driver, roomCollectionPrefix, groupName, actorId, "user", userId);
  };
  await fixedAddActorGroup("All");
  await fixedAddActorGroup("Users");
  if (user.type === "PL") await fixedAddActorGroup("Players");
  if (user.type === "GM") await fixedAddActorGroup("GameMasters");
  if (user.type === "VISITOR") await fixedAddActorGroup("Visitors");

  const createChatPaletteObj = (name: string): ChatPaletteStore => ({
    name,
    paletteText: "",
    chatFontColorType: "owner",
    chatFontColor: "#000000",
    actorId: null,
    sceneObjectId: null,
    targetId: null,
    outputTabId: null,
    statusId: null,
    system: null,
    isSecret: false
  });
  const chatPaletteList: ChatPaletteStore[] = [
    createChatPaletteObj("1"),
    createChatPaletteObj("2"),
    createChatPaletteObj("3"),
    createChatPaletteObj("4"),
    createChatPaletteObj("5"),
  ];
  await addDirect(driver, socket, {
    collection: `${roomCollectionPrefix}-DATA-chat-palette-list`,
    dataList: chatPaletteList,
    optionList: chatPaletteList.map(_ => ({
      ownerType: "user",
      owner: userId
    }))
  }, false);

  return docRef;
}
