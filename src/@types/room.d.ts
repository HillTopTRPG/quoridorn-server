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

export type CreateRoomRequest = BaseRoomInfo & {
  roomNo: number;
  password: string;
};

export type GetRoomListResponse = BaseRoomInfo & {
  memberNum: number;
  hasPassword: boolean;
};

export type LoginResponse = BaseRoomInfo & {
  memberNum: number;
  hasPassword: boolean;
  roomCollectionSuffix: string;
};

export type RoomStore = BaseRoomInfo & {
  memberNum: number;
  hasPassword: boolean;
  password: string;
  roomCollectionSuffix: string;
};

export type RoomViewerStore = {
  socketId: string;
};

export type RoomViewResponse = {
  changeType: ChangeType;
  id: string;
  data?: StoreObj<GetRoomListResponse>;
  createTime?: Date,
  updateTime?: Date
};
