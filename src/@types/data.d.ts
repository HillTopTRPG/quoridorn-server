import {LoginResponse, UserType} from "./socket";

export type RoomStore = LoginResponse & {
  roomPassword: string;
};

export type UserStore = {
  name: string;
  password: string;
  type: UserType;
  token: string;
  login: number;
};

export type TouchierStore = {
  collection: string;
  docId: string;
  socketId: string;
  time: Date;
  backupUpdateTime: Date | null;
};

export type SocketStore = {
  socketId: string;
  roomId: string | null;
  roomCollectionPrefix: string | null;
  storageId: string | null;
  userId: string | null;
  connectTime: Date;
}

export type SocketUserStore = {
  socketId: string;
  userId: string;
}

export type ActorGroup = {
  name: string;
  isSystem: boolean;
  list: {
    id: string;
    type: "user" | "other";
    userId: string | null;
  }[];
};

export type ActorStore = {
  name: string; // 名前
  type: "user" | "character";
  tag: string;
  pieceIdList: string[]; // コマのID一覧
  chatFontColorType: "owner" | "original"; // チャット文字色はオーナー（ユーザ）の色か独自の色か
  chatFontColor: string; // 独自のチャット文字色
  standImagePosition: number; // 1〜12
  statusId: string; // ステータスへの参照
  isUseTableData: boolean; // イニシアティブ表のデータを持つかどうか
};

type ActorStatusStore = {
  // actorId: string; actorIdはownerで管理
  name: string; // ステータス名
  isSystem: boolean;
  standImageInfoId: string | null; // id
  chatPaletteInfoId: string | null; // id
};
