import {ChangeType} from "nekostore/lib/DocumentChange";
import {StoreMetaData, StoreObj} from "./store";
import {TargetVersion} from "../utility/GitHub";
import {CutInDeclareInfo, MediaInfo, Scene} from "./data";

export type RoomInfoExtend = {
  visitable: boolean;
  chatWindow: boolean;
  dice: boolean;
  initiativeWindow: boolean;
  resourceWindow: boolean;
  chatPaletteWindow: boolean;
  counterRemocon: boolean;
  standImage: boolean;
  cutIn: boolean;
  drawMapAddress: boolean;
  drawMapGrid: boolean;
  autoFitMapCell: boolean;
};

export type BaseRoomInfo = {
  name: string;
  bcdiceServer: string;
  system: string;
  extend?: RoomInfoExtend; // 一時的措置
};

export type RoomLoginInfo = {
  roomId: string;
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
  userId: string;
  token: string;
}

export type TouchRoomRequest = {
  roomNo: number;
};
export type ReleaseTouchRoomRequest = TouchRoomRequest

export type CreateRoomRequest = RoomLoginInfo & BaseRoomInfo;
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
  roomList: (StoreObj<ClientRoomInfo> & StoreMetaData)[] | null,
  message: Message;
};

export type RoomViewResponse = {
  changeType: ChangeType;
  id: string;
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

export type TouchDataRequest = {
  collection: string;
  idList?: string[];
  optionList?: Partial<StoreObj<unknown>>[];
};
export type DeleteFileRequest = {
  urlList: string[];
};
export type TouchModifyDataRequest = TouchDataRequest & {
  idList: string[];
};
export type ReleaseTouchDataRequest = TouchModifyDataRequest & {
  optionList?: (Partial<StoreObj<unknown>> & { continuous?: boolean })[];
};

export type AddDirectRequest = {
  collection: string;
  dataList: any[];
  optionList?: Partial<StoreObj<unknown>>[];
};
export type CreateDataRequest = TouchModifyDataRequest & {
  dataList: any[];
};
export type DeleteDataRequest = TouchModifyDataRequest;
export type UpdateDataRequest = TouchModifyDataRequest & {
  dataList: any[];
  optionList?: (Partial<StoreObj<unknown>> & { continuous?: boolean })[];
};

export type SendDataRequest = {
  targetList: string[],
  data: any;
};

export type UploadFileInfo = {
  name: string;
  src: string;
};

export type UploadFileRequest = UploadFileInfo[];

type AddRoomPresetDataRequest = {
  mediaDataList: MediaInfo[],
  backgroundMediaIndex: number,
  cutInDataList: CutInDeclareInfo[],
  sceneData: Scene,
  roomExtendInfo: RoomInfoExtend,
  roomName: string,
  language: {
    mainChatTabName: string,
    allGroupChatTabName: string,
    nameLabel: string
  }
};
