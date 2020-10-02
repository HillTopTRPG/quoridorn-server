import {ChangeType} from "nekostore/lib/DocumentChange";
import {TargetVersion} from "../utility/GitHub";

type WindowSetting =
  | "not-use" // 使えなくします
  | "free" // 特に指定はありません
  | "init-view" // 入室時に表示します
  | "always-open"; // 常に開いています。閉じることはできません。

type WindowSettings = {
  chat: WindowSetting;
  resource: WindowSetting;
  initiative: WindowSetting;
  chatPalette: WindowSetting;
  counterRemocon: WindowSetting;
};

type RoomInfoExtend = {
  visitable: boolean; // 見学許可
  isFitGrid: boolean; // マップオブジェクトをセルに自動調整するか
  isViewDice: boolean; // ダイスを表示するか
  isViewCutIn: boolean; // カットインを表示するか
  isDrawGridId: boolean; // マップ座標を表示するか
  mapRotatable: boolean; // マップを回転させるか
  isDrawGridLine: boolean; // マップ罫線を表示するか
  isShowStandImage: boolean; // 立ち絵を表示するか,
  isShowRotateMarker: boolean; // マップオブジェクトの回転マーカーを表示するか
  windowSettings: WindowSettings;
};

type BaseRoomInfo = {
  name: string;
  bcdiceServer: string;
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

type ImportType = "add" | "update" | "all-cover";

type AddDirectRequest<T> = {
  collection: string;
  list: (Partial<StoreData<T>> & { data: T })[];
  importType?: ImportType;
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

type AddRoomPresetDataRequest = {
  roomName: string;
  roomExtendInfo: RoomInfoExtend;
  sceneData: SceneStore;
  cutInDataList: CutInStore[];
  diceMaterial: DiceMaterial,
  likeList: LikeStore[],
  language: {
    mainChatTabName: string;
    allGroupChatTabName: string;
    nameLabel: string;
  };
};

type ImportRequest = {
  importType: ImportType;
  list: StoreData<any>[];
};
