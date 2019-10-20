export type ServerSetting = {
  port: number;
  storeType: "memory" | "mongodb";
  secretCollectionSuffix: string;
  mongodbConnectionStrings: string;
  roomNum: number;
  roomAutoRemove: number;
  systemCollectionTouchTimeout: number;
};

export type RoomSecretInfo = {
  roomId: string;
  password: string;
  roomCollectionSuffix: string;
};