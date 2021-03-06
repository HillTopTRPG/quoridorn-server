import {ChangeType} from "nekostore/lib/DocumentChange";
import {TargetVersion} from "../utility/GitHub";

type BaseRoomInfo = {
  name: string;
  bcdiceServer: string;
  bcdiceVersion: string;
  system: string;
  extend?: RoomInfoExtend; // 一時的措置
};

type RoomLoginInfo = {
  roomKey: string;
  roomNo: number;
  roomPassword: string;
};

type RoomLoginRequest = RoomLoginInfo;

type UserType = "GM" | "PL" | "VISITOR";

type UserLoginRequest = {
  name: string;
  type?: UserType;
  password: string;
};

type UserLoginResponse = {
  userKey: string;
  token: string;
}

type TouchRoomRequest = {
  roomNo: number;
};
type ReleaseTouchRoomRequest = TouchRoomRequest

type CreateRoomRequest = RoomLoginInfo & BaseRoomInfo & {
  roomCreatePassword?: string;
};
type DeleteRoomRequest = RoomLoginInfo;

type ClientRoomInfo = BaseRoomInfo & {
  memberNum: number;
  hasPassword: boolean;
};
type Message = {
  title: string;
  descriptions: string[];
  termsOfUse: string;
};
type GetRoomListResponse = {
  roomList: StoreData<ClientRoomInfo>[] | null;
  message: Message;
  isNeedRoomCreatePassword: boolean;
};

type RoomViewResponse = {
  changeType: ChangeType;
  data?: StoreData<ClientRoomInfo>;
  id: string;
};

type LoginResponse = ClientRoomInfo & {
  roomCollectionPrefix: string;
  storageId: string;
};

type GetVersionResponse = {
  version: string;
  title: string;
  targetClient: TargetVersion;
};

type TouchDataRequest<T> = {
  collection: string;
  list: (Partial<StoreData<T>> & { key: string; continuous?: boolean; })[];
};
type DeleteFileRequest = {
  urlList: string[];
};
type TouchModifyDataRequest<T> = TouchDataRequest<T>;
type ReleaseTouchDataRequest<T> = TouchDataRequest<T>;

type ImportLevel =
  | "full" // 部屋データ全体
  | "user" // ユーザーデータ
  | "actor" // アクターデータ
  | "part"; // 個別データ

type AddDirectRequest<T> = {
  collection: string;
  list: (Partial<StoreData<T>> & { data: T })[];
  importLevel?: ImportLevel;
};
type DeleteDataRequest<T> = TouchDataRequest<T>;
type UpdateDataRequest<T> = TouchDataRequest<T> & {
  list: (Partial<StoreData<T>> & { key: string, continuous?: boolean })[];
};

type SendDataRequest = {
  targetList: string[],
  data: any;
};

type UploadMediaInfo = MediaStore & { key?: string } & (
  | { dataLocation: "direct" }
  | {
  dataLocation: "server";
  blob: Blob;
  arrayBuffer: string;
}
  );

type UploadMediaRequest = {
  uploadMediaInfoList: UploadMediaInfo[];
  option: Partial<StoreData<any>>;
};

type UploadMediaResponse = {
  key: string;
  rawPath: string;
  url: string;
  name: string;
  tag: string;
  urlType: UrlType;
}[];

type DiceInfo = {
  type: string;
  label: string;
  pips: { [P: string]: string };
};
type DiceMaterial = { [P: string]: DiceInfo[] };

type LikeStore = {
  char: string;
  isThrowLinkage: boolean;
  linkageResourceKey: string | null;
};

type OriginalTableStore = {
  commandName: string;
  diceRoll: string;
  tableTitle: string;
  tableContents: {
    [key in string]: string;
  };
  bcdiceServer: string | null;
  bcdiceVersion: string | null;
  system: string; // yamlファイルには未記載。プログラムで設定する変数。
};

type AddRoomPresetDataRequest = {
  roomName: string;
  bcdiceServer: string; // BCDiceサーバー
  bcdiceVersion: string; // BCDiceAPIバージョン
  system: string; // BCDiceSystem
  roomExtendInfo: RoomInfoExtend;
  sceneData: SceneStore;
  cutInDataList: CutInStore[];
  diceMaterial: DiceMaterial,
  likeList: LikeStore[],
  originalTableList: OriginalTableStore[];
  language: {
    mainChatTabName: string;
    allGroupChatTabName: string;
    nameLabel: string;
  };
};

type ImportRequest = {
  [importLevel in ImportLevel]: StoreData<any>[];
};
