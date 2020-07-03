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
};

type ActorStatusStore = {
  // actorId: string; actorIdはownerで管理
  name: string; // ステータス名
  isSystem: boolean;
  standImageInfoId: string | null; // id
  chatPaletteInfoId: string | null; // id
};

/**
 * 画像の付与情報の定義の1つ
 * 向き
 */
type Direction = "none" | "horizontal" | "vertical" | "180";

// リソース定義
type ResourceType =
  | "no-contents"
  | "ref-actor"
  | "ref-map-object"
  | "text"
  | "input-text"
  | "number"
  | "check"
  | "select"
  | "combo"
  | "color";

type ResourceMasterStore = {
  label: string;
  type: ResourceType;
  isSystem: boolean; // ユーザに編集制限を加えるかどうか
  isAutoAddActor: boolean; // アクターに自動付与するかどうか
  isAutoAddMapObject: boolean; // コマに自動付与するかどうか
  isInitiative: boolean; // イニシアティブ値かどうか
  iconImageId: string | null; // アイコンを設定するならその画像のID
  iconImageTag: string | null; // アイコンを設定するならその画像のタグ
  iconImageDirection: Direction | null; // アイコンを設定するならその画像の表示方法
  refProperty: string; // 参照先プロパティ
  min: number | null; // 数値の場合、その最小値
  max: number | null; // 数値の場合、その最大値
  interval: number | null; // 数値の場合、その変化値
  selectionStr: string | null; // radio or select or comboの場合、その候補
  defaultValue: string;
};

// リソースインスタンス
type ResourceStore = {
  // 誰のリソースかはownerで表現
  masterId: string;
  type: ResourceType;
  value: string;
};
