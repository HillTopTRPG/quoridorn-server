import {ChangeType} from "nekostore/lib/DocumentChange";
import {StoreObj, StoreUseData} from "./store";
import {TargetVersion} from "../utility/GitHub";
import {CutInDeclareInfo, MediaInfo, Scene, UrlType} from "./data";

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

export type RoomInfoExtend = {
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

export type BaseRoomInfo = {
  name: string;
  bcdiceServer: string;
  system: string;
  extend?: RoomInfoExtend; // 一時的措置
};

export type RoomLoginInfo = {
  roomKey: string;
  roomNo: number;
  roomPassword: string;
};

export type RoomLoginRequest = RoomLoginInfo;

type UserType = "GM" | "PL" | "VISITOR";

export type UserLoginRequest = {
  name: string;
  type?: UserType;
  password: string;
};

export type UserLoginResponse = {
  userKey: string;
  token: string;
}

export type TouchRoomRequest = {
  roomNo: number;
};
export type ReleaseTouchRoomRequest = TouchRoomRequest

export type CreateRoomRequest = RoomLoginInfo & BaseRoomInfo & {
  roomCreatePassword?: string;
};
export type DeleteRoomRequest = RoomLoginInfo;

export type ClientRoomInfo = BaseRoomInfo & {
  memberNum: number;
  hasPassword: boolean;
};
export type Message = {
  title: string;
  descriptions: string[];
  termsOfUse: string;
};
export type GetRoomListResponse = {
  roomList: StoreObj<ClientRoomInfo>[] | null;
  message: Message;
  isNeedRoomCreatePassword: boolean;
};

export type RoomViewResponse = {
  changeType: ChangeType;
  key: string;
  data?: StoreObj<ClientRoomInfo>;
};

export type LoginResponse = ClientRoomInfo & {
  roomCollectionPrefix: string;
  storageId: string;
};

export type GetVersionResponse = {
  version: string;
  title: string;
  targetClient: TargetVersion;
};

export type TouchDataRequest<T> = {
  collection: string;
  optionList: (Partial<StoreObj<T>> & { key: string; continuous?: boolean; })[];
};
export type DeleteFileRequest = {
  urlList: string[];
};
export type TouchModifyDataRequest<T> = TouchDataRequest<T>;
export type ReleaseTouchDataRequest<T> = TouchModifyDataRequest<T>;

export type AddDirectRequest<T> = {
  collection: string;
  dataList: T[];
  optionList?: Partial<StoreUseData<T>>[];
};
export type DeleteDataRequest<T> = TouchModifyDataRequest<T>;
export type UpdateDataRequest<T> = TouchModifyDataRequest<T> & {
  dataList: T[];
};

export type SendDataRequest = {
  targetList: string[],
  data: any;
};

export type UploadMediaInfo = MediaInfo & (
  | { dataLocation: "direct"; }
  | {
    dataLocation: "server";
    blob: Blob;
    arrayBuffer: string;
  }
);

export type UploadMediaRequest = {
  uploadMediaInfoList: UploadMediaInfo[];
  option: Partial<StoreObj<any>>;
};

export type UploadMediaResponse = {
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
  sceneData: Scene;
  cutInDataList: CutInDeclareInfo[];
  diceMaterial: DiceMaterial,
  likeList: LikeStore[],
  language: {
    mainChatTabName: string;
    allGroupChatTabName: string;
    nameLabel: string;
  };
};
