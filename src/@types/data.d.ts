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
  | "ref-normal"
  | "ref-owner"
  | "text"
  | "input-text"
  | "number"
  | "check"
  | "select"
  | "combo"
  | "color";

type RefProperty =
  | "name"
  | "type"
  | "tag"
  | "actor-name"
  | "actor-type"
  | "actor-tag"
  | "owner-name"
  | "owner-type"
  | "object-other-text"
  | "object-layer"
  | "actor-status-name"
  | "actor-chat-text-color"
  | "actor-stand-image-position";

type ResourceMasterStore = {
  label: string;
  type: ResourceType;
  systemColumnType: "name" | "initiative" | null; // システム列の種類
  isAutoAddActor: boolean; // アクターに自動付与するかどうか
  isAutoAddMapObject: boolean; // コマに自動付与するかどうか
  iconImageId: string | null; // アイコンを設定するならその画像のID
  iconImageTag: string | null; // アイコンを設定するならその画像のタグ
  iconImageDirection: Direction | null; // アイコンを設定するならその画像の表示方法
  refProperty: RefProperty | null; // 参照先プロパティ
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

type MediaInfo = {
  tag: string;
  name: string;
  url: string;
  type: string;
};

/**
 * cutInDataCCのデータ定義
 */
type CutInDeclareInfo = {
  url: string;
  title: string;
  tag: string;
  isRepeat: boolean;
  fadeIn: number;
  fadeOut: number;
  start: number;
  end: number;
  volume: number;
  chatLinkageType: "none" | "last" | "regexp";
  chatLinkageTarget: string;
  isStandBy: boolean;
  isForceNew: boolean;
  isForceContinue: boolean;
  duration?: number; // 長さ（再生することで得られる）
};

/**
 * マップの背景の定義の1つ
 * 背景色による指定
 */
type TextureColor = {
  type: "color";
  backgroundColor: string;
  fontColor: string;
  text: string;
};

/**
 * 画像の付与情報の定義の1つ
 * 表示サイズ
 */
type BackgroundSize =
  | "contain"
  | "cover-start"
  | "cover-center"
  | "cover-end"
  | "100%";

/**
 * マップの背景の定義の1つ
 * 画像による指定
 */
type TextureImage = {
  type: "image";
  imageTag: string;
  imageId: string;
  direction: Direction;
  backgroundSize: BackgroundSize;
};

/**
 * マップの背景の定義の集合体
 */
type Texture = TextureColor | TextureImage;

type ChatLinkable = {
  chatLinkage: number;
  chatLinkageSearch: string;
};

/**
 * 画面を切替える際の演出の選定情報
 */
type SceneSwitch = {
  priority: number; // 優先順位。１が最も優先。
  direction: "normal" | ""; // 演出方法
};

/**
 * CSS的な罫線の定義
 */
type Border = {
  width: number;
  color: string;
  style:
    | "solid"
    | "groove"
    | "ridge"
    | "inset"
    | "outset"
    | "double"
    | "dotted"
    | "dashed";
};

type Scene = ChatLinkable & {
  name: string;
  columns: number;
  rows: number;
  gridSize: number;
  gridColor: string;
  fontColor: string;
  portTileMapping: string; // タイル番号の羅列
  switchBefore: SceneSwitch;
  switchAfter: SceneSwitch;
  shapeType:
    | "square"
    | "hex-horizontal-slim"
    | "hex-horizontal-fat"
    | "hex-horizontal-start"
    | "hex-horizontal-end"
    | "hex-vertical-slim"
    | "hex-vertical-fat"
    | "hex-vertical-start"
    | "hex-vertical-end";
  texture: Texture;
  background: {
    texture: Texture;
    maskBlur: number;
  };
  margin: {
    useTexture: "original" | "same map" | "same background";
    texture: Texture;
    columns: number;
    rows: number;
    isUseGrid: boolean;
    gridColorBold: string;
    gridColorThin: string;
    maskColor: string;
    maskBlur: number;
    border: Border;
  };
};
