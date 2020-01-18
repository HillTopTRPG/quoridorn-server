import {LoginResponse, UserType} from "./socket";

export type RoomStore = LoginResponse & {
  roomPassword: string;
};

export type UserStore = {
  userName: string;
  userPassword: string;
  token: string;
  userType: UserType;
  login: number;
};

export type TouchierStore = {
  collection: string;
  docId: string;
  socketId: string;
  time: Date;
};

export type SocketStore = {
  socketId: string;
  roomId: string | null;
  userId: string | null;
  connectTime: Date;
}

export type ActorGroup = {
  name: string;
  isSystem: boolean;
  isChatGroup: boolean;
  list: {
    type: "user" | "character";
    id: string;
  }[];
};
