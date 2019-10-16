export type ServerSetting = {
  port: number;
  storeType: "memory" | "mongodb";
  secretCollectionSuffix: string;
  mongodbConnectionStrings: string;
  roomNum: number;
  roomAutoRemove: number;
};

export type RoomPrivateCollection = {
  roomId: string;
  password: string;
  roomCollectionSuffix: string;
};