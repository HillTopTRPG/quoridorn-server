import Driver from "nekostore/lib/Driver";
import {ImportLevel, UserLoginResponse, UserType} from "../@types/socket";
import {hash} from "./password";
import {hashAlgorithm, PERMISSION_OWNER} from "../server";
import {findSingle, getSocketDocSnap, resistCollectionName} from "./collection";
import {addAuthorityGroup} from "./data-authority-group";
import {addActorRelation} from "./data-actor";
import uuid = require("uuid");
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

  const userKey = (await addDirect<UserStore>(driver, socket, {
    collection: userListCCName,
    list: [{
      ownerType: null,
      owner: null,
      order: -1,
      data: {name, password, token, type, login: 1, isExported: false }
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
  data: Partial<StoreData<UserStore>> & { data: UserStore },
  importLevel?: ImportLevel
): Promise<DocumentSnapshot<StoreData<UserStore>> | null> {
  const roomCollectionPrefix = collectionName.replace(/-DATA-.+$/, "");
  const user = data.data;

  if (importLevel && importLevel !== "full") {
    data.data.isExported = true;
  }

  // データ整合性調整
  if (!user.login) user.login = 0;
  if (!user.token) user.token = uuid.v4();

  const duplicateUser = await findSingle<StoreData<UserStore>>(
    driver,
    collectionName,
    "data.name",
    user.name
  );
  if (duplicateUser) return null;

  // 追加
  const docRef = await addSimple<UserStore>(driver, socket, collectionName, data);
  if (!docRef) return null;
  const userKey = docRef.data!.key;

  // socket情報にuserKeyを登録
  if (!importLevel) {
    const socketDocSnap = (await getSocketDocSnap(driver, socket.id));
    await socketDocSnap.ref.update({
      userKey
    });
  }

  // アクターを追加
  // importLevel:full :: インポートデータに含まれているのでこの処理は不要
  // importLevel:user :: インポートデータに含まれているのでこの処理は不要
  // importLevel:actor:: インポートデータに含まれているのでこの処理は不要
  // importLevel:part :: 勝手に追加したら迷惑なのでこの処理は不要
  if (!importLevel) {
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
          tag: "",
          isExported: false
        }
      }
    ))!.data!.key;
    await resistCollectionName(driver, actorCollectionName);

    // アクターグループに追加
    const fixedAddAuthorityGroup = async (groupName: string) => {
      await addAuthorityGroup(driver, roomCollectionPrefix, groupName, actorKey, "user", userKey);
    };
    await fixedAddAuthorityGroup("All");
    await fixedAddAuthorityGroup("Users");
    if (user.type === "PL") await fixedAddAuthorityGroup("Players");
    if (user.type === "GM") await fixedAddAuthorityGroup("GameMasters");
    if (user.type === "VISITOR") await fixedAddAuthorityGroup("Visitors");
  }

  // チャットパレット（デフォルト）を登録
  // importLevel:full :: インポートデータに含まれているのでこの処理は不要
  // importLevel:user :: インポートデータに含まれているのでこの処理は不要
  // importLevel:actor:: 勝手に追加したら迷惑なのでこの処理は不要
  // importLevel:part :: 勝手に追加したら迷惑なのでこの処理は不要
  if (!importLevel) {
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
        ownerType: "user-list",
        owner: userKey,
        permission: PERMISSION_OWNER,
        data: cp
      }))
    }, false);
  }

  return docRef;
}
