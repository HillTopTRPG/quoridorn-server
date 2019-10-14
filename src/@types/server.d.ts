export type ServerSetting = {
  port: number;
  storeType: "memory" | "mongodb";
  mongodbConnectionStrings: string;
  roomNum: number;
  roomAutoRemove: number;
};