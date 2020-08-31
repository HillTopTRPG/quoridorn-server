export type ServerSetting = {
  port: number;
  webApiPassword: string;
  webApiPathBase: string;
  webApiTokenExpires: number;
  storeType: "memory" | "mongodb";
  secretCollectionSuffix: string;
  mongodbConnectionStrings: string;
  roomNum: number;
  roomAutoRemove: number;
};

export type StorageSetting = {
  bucket: string;
  accessUrl: string;
  endPoint: string;
  port: number;
  accessKey: string;
  secretKey: string;
  useSSL: boolean;
};

export type Interoperability = {
  server: string;
  client: string;
};
