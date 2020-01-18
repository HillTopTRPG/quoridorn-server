import {ChangeType} from "nekostore/lib/DocumentChange";
import {Permission, StoreMetaData, StoreObj} from "./store";
import {TargetVersion} from "../utility/GitHub";

type MapShape = "square" | "horizontal-hex" | "vertical-hex";

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
  mapShape: MapShape;
  drawMapShape: boolean;
  autoFitMapShape: boolean;
  autoResizeStandImage: boolean;
};

export type BaseRoomInfo = {
  name: string;
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
  userName: string;
  userType?: UserType;
  userPassword: string;
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
};

export type GetVersionResponse = {
  version: string;
  title: string;
  targetClient: TargetVersion;
};

export type TouchDataRequest = {
  collection: string;
  id?: string;
};
export type TouchModifyDataRequest = TouchDataRequest & {
  id: string;
};
export type ReleaseTouchDataRequest = TouchModifyDataRequest & {
  continuous?: boolean;
};

export type CreateDataRequest = TouchModifyDataRequest & {
  order?: number;
  data: any;
  permission: Permission;
};
export type DeleteDataRequest = TouchModifyDataRequest;
export type UpdateDataRequest = TouchModifyDataRequest & {
  order?: number;
  data: any;
  permission?: Permission;
  continuous?: boolean;
};
