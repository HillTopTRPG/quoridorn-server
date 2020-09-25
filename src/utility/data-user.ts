import Driver from "nekostore/lib/Driver";
import {UserLoginResponse, UserType} from "../@types/socket";
import {hash} from "./password";
import {hashAlgorithm, PERMISSION_OWNER} from "../server";
import {getSocketDocSnap, resistCollectionName} from "./collection";
import {addActorGroup} from "./data-actor-group";
import {addActorRelation} from "./data-actor";
import uuid = require("uuid");
import {StoreObj} from "../@types/store";
import {ChatPaletteStore, UserStore} from "../@types/data";
import {addDirect} from "../event/add-direct";
import {addSimple} from "./data";
import DocumentSnapshot from "nekostore/lib/DocumentSnapshot";

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

  const userKey = (await addDirect(driver, socket, {
    collection: userListCCName,
    list: [{
      ownerType: null,
      owner: null,
      order: -1,
      data: {name, password, token, type, login: 1 }
    }]
  }, false))[0];

  return {
    userKey,
    token
  };
}

export async function addUserRelation(
  driver: Driver,
  socket: any,
  collectionName: string,
  data: Partial<StoreObj<any>> & { data: any }
): Promise<DocumentSnapshot<StoreObj<UserStore>> | null> {
  const roomCollectionPrefix = collectionName.replace(/-DATA-.+$/, "");
  const docRef = await addSimple<UserStore>(driver, socket, collectionName, data);
  if (!docRef) return null;
  const userKey = docRef.data!.key;

  const socketDocSnap = (await getSocketDocSnap(driver, socket.id));

  await socketDocSnap.ref.update({
    userKey
  });

  const user = data.data;

  const actorCollectionName = `${roomCollectionPrefix}-DATA-actor-list`;
  const actorKey: string = (await addActorRelation(
    driver,
    socket,
    actorCollectionName,
    {
      data: {
        name: user.name,
        type: "user",
        chatFontColorType: "original",
        chatFontColor: "#000000",
        standImagePosition: 1,
        pieceKeyList: [],
        statusKey: "",
        tag: ""
      }
    }
  ))!.data!.key;
  await resistCollectionName(driver, actorCollectionName);

  const fixedAddActorGroup = async (groupName: string) => {
    await addActorGroup(driver, roomCollectionPrefix, groupName, actorKey, "user", userKey);
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
    actorKey: null,
    sceneObjectKey: null,
    targetKey: null,
    outputTabKey: null,
    statusKey: null,
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
    list: chatPaletteList.map(cp => ({
      ownerType: "user",
      owner: userKey,
      permission: PERMISSION_OWNER,
      data: cp
    }))
  }, false);

  return docRef;
}
