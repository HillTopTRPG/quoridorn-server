import {ChangeType} from "nekostore/lib/DocumentChange";
import {StoreObj} from "./store";

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

export type GetRoomListResponse = BaseRoomInfo & {
  memberNum: number;
  hasPassword: boolean;
};

export type RoomViewResponse = {
  changeType: ChangeType;
  id: string;
  data?: StoreObj<GetRoomListResponse>;
  createTime?: Date,
  updateTime?: Date
};

export type LoginResponse = GetRoomListResponse & {
  roomCollectionSuffix: string;
};

export type RoomStore = LoginResponse & {
  roomPassword: string;
};

export type RoomViewerStore = {
  socketId: string;
};

export type UseStore = UserLoginRequest & {
  userType: UserType;
};
