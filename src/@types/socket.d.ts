import {ChangeType} from "nekostore/lib/DocumentChange";
import {StoreMetaData, StoreObj} from "./store";

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

type UserType = "GM" | "PL" | "VISITOR";

export type UserLoginRequest = {
  roomId: string;
  userName: string;
  userType?: UserType;
  userPassword: string;
};

export type TouchRequest = {
  roomNo: number;
};
export type ReleaseTouchRequest = TouchRequest

export type LoginRequest = RoomLoginInfo & UserLoginRequest;
export type CreateRoomRequest = LoginRequest & BaseRoomInfo;
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
  roomList: (StoreObj<ClientRoomInfo> & StoreMetaData)[],
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

export type RoomStore = LoginResponse & {
  roomPassword: string;
};

export type UserStore = {
  userName: string;
  userPassword: string;
  userType: UserType;
  login: number;
};

export type GetVersionResponse = {
  version: string;
  title: string;
};

export type TouchierStore = {
  collection: string;
  docId: string;
  socketId: string;
  time: Date;
};

export type SocketStore = {
  socketId: string;
  roomId: string | null;
  userId: string | null;
  connectTime: Date;
}
