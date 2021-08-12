import {LoginResponse} from "./socket";

export type RoomStore = LoginResponse & {
  roomPassword?: string;
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
  roomNo: number | null;
  roomCollectionPrefix: string | null;
  storageId: string | null;
  userKey: string | null;
  connectTime: Date;
}
