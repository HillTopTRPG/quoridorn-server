import {LoginResponse, RoomInfoExtend, UserType} from "./socket";

export type RoomStore = LoginResponse & {
  roomPassword: string;
};

type ChatTabInfo = {
  name: string;
  isSystem: boolean;
  useReadAloud: boolean;
  readAloudVolume: number;
};

/**
 * roomDataCCのデータ定義
 * 部屋1つに関する設定情報
 */
type RoomData = {
  name: string;
  sceneKey: string;
  settings: RoomInfoExtend;
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
  key: string;
  socketId: string;
  time: Date;
  backupUpdateTime: Date | null;
};

export type TokenStore = {
  type: "server" | "room" | "user";
  token: string;
  roomCollectionPrefix: string | null;
  roomNo: number | null;
  storageId: string | null;
  userKey: string | null;
  expires: Date;
}

export type SocketStore = {
  socketId: string;
  roomKey: string | null;
  roomCollectionPrefix: string | null;
  storageId: string | null;
  userKey: string | null;
  connectTime: Date;
}

export type SocketUserStore = {
  socketId: string;
  userKey: string;
}

export type GroupChatTabInfo = {
  name: string;
  isSystem: boolean;
  actorGroupKey: string;
  isSecret: boolean;
  outputChatTabKey: string | null;
};

export type ActorGroup = {
  name: string;
  isSystem: boolean;
  list: {
    key: string;
    type: "user" | "other";
    userKey: string | null;
  }[];
};

export type ActorStore = {
  name: string; // 名前
  type: "user" | "character";
  tag: string;
  pieceKeyList: string[]; // コマのID一覧
  chatFontColorType: "owner" | "original"; // チャット文字色はオーナー（ユーザ）の色か独自の色か
  chatFontColor: string; // 独自のチャット文字色
  standImagePosition: number; // 1〜12
  statusKey: string; // ステータスへの参照
};

type ActorStatusStore = {
  // actorId: string; actorIdはownerで管理
  name: string; // ステータス名
  isSystem: boolean;
  standImageInfoKey: string | null; // id
  chatPaletteInfoKey: string | null; // id
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

// イニシアティブ表の列の定義
type InitiativeColumnStore = {
  resourceMasterKey: string;
};

type ResourceMasterStore = {
  label: string;
  type: ResourceType;
  systemColumnType: "name" | "initiative" | null; // システム列の種類
  isAutoAddActor: boolean; // アクターに自動付与するかどうか
  isAutoAddMapObject: boolean; // コマに自動付与するかどうか
  icon: {
    mediaKey: string | null; // アイコンを設定するならその画像のID
    mediaTag: string | null; // アイコンを設定するならその画像のタグ
    imageDirection: Direction | null; // アイコンを設定するならその画像の表示方法
  };
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
  masterKey: string;
  type: ResourceType;
  value: string;
};

export type IconClass =
  | "icon-warning"
  | "icon-youtube2"
  | "icon-image"
  | "icon-music"
  | "icon-text";

export type UrlType =
  | "youtube"
  | "image"
  | "music"
  | "setting"
  | "unknown";

type MediaInfo = {
  name: string;
  rawPath: string;
  mediaFileId: string;
  tag: string;
  url: string;
  urlType: UrlType;
  iconClass: IconClass;
  imageSrc: string;
  dataLocation: "server" | "direct";
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
  mediaTag: string;
  mediaKey: string;
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

type Point = {
  x: number;
  y: number;
};

type Matrix = {
  column: number;
  row: number;
};

type Address = Point & Matrix;

/**
 * マップレイヤーの種別
 */
type SceneLayerType =
  | "floor-tile"
  | "map-mask"
  | "map-marker"
  | "dice-symbol"
  | "card"
  | "character"
  | "other";

/**
 * sceneLayerCCのデータ定義
 * マップレイヤー1層の情報
 */
type SceneLayer = {
  type: SceneLayerType;
  defaultOrder: number; // マップ設定をいじらなければこのオーダー順に従う(= z-index)
  isSystem: boolean; // システムレイヤーは削除させない
  name?: string; // ユーザが追加するレイヤーのみこのフィールドを使う
};

/**
 * sceneAndLayerCCのデータ定義
 * マップとレイヤーの紐付き1本単位の情報
 */
type SceneAndLayer = {
  sceneKey: string;
  layerKey: string;
  isUse: boolean;
};

/**
 * sceneAndObjectCCのデータ定義
 * マップとオブジェクトの紐付き1本単位の情報
 */
type SceneAndObject = {
  sceneKey: string;
  objectKey: string;
  // startTimeStatus: "" | "normal" | string; // マップに同期切替した際に設定されるステータス（キャラクターのみ）
  // startTimePlace: "" | Place; // マップに同期切替した際に設定される場所
  isOriginalAddress: boolean; // マップ独自の座標を持つかどうか
  originalAddress: Address | null; // 独自座標を持つならその座標
  entering: "normal" | string; // 登場の仕方
};

type ChatPaletteStore = {
  name: string,
  paletteText: string;
  chatFontColorType: "owner" | "original"; // チャット文字色はオーナーの色か独自の色か
  chatFontColor: string; // 独自のチャット文字色
  actorKey: string | null;
  sceneObjectKey: string | null;
  targetKey: string | null;
  outputTabKey: string | null;
  statusKey: string | null;
  system: string | null;
  isSecret: boolean;
};

export type DiceType = {
  faceNum: string;
  subType: string;
  label: string;
};

export type DiceAndPips = {
  diceTypeKey: string;
  pips: string;
  mediaKey: string;
};

type SceneObjectType =
  | "character"
  | "map-mask"
  | "map-marker"
  | "dice-symbol"
  | "chit"
  | "floor-tile";

type Place = "field" | "graveyard" | "backstage";
type SceneObject = Address & {
  type: SceneObjectType;
  tag: string;
  name: string;
  actorKey: string | null; // id
  rows: number;
  columns: number;
  isHideBorder: boolean;
  isHideHighlight: boolean;
  isLock: boolean;
  place: Place;
  layerKey: string;
  textures: Texture[];
  textureIndex: number;
  angle: number;
  url: string; // character
  subTypeKey: string; // サイコロの種類など
  subTypeValue: string; // 出目など
  isHideSubType: boolean; // 出目を隠すかどうか
};
