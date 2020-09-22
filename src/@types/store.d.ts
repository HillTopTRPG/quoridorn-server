import CollectionReference from "nekostore/src/CollectionReference";

export type StoreObj<T> = {
  collection: string;
  key: string;
  ownerType: string | null;
  owner: string | null;
  order: number;
  exclusionOwner: string | null; // 排他制御のオーナー
  lastExclusionOwner: string | null; // 排他制御のオーナー
  permission: Permission | null; // 通常はnullではない
  status: "initial-touched" | "added" | "modify-touched" | "touched-released" | "modified" | null;
  createTime: Date | null;
  updateTime: Date | null;
  data?: T;
};

export type StoreMetaData = {
  id: string | null;
};

export type StoreUseData<T> = StoreObj<T> & StoreMetaData;

export type PermissionNode = {
  type: "group" | "actor" | "owner";
  key?: string;
};

export type PermissionRule = {
  type: "none" | "allow" | "deny";
  list: PermissionNode[];
};

export type Permission = {
  view: PermissionRule;
  edit: PermissionRule;
  chmod: PermissionRule;
};

type GetDataOption<T> = {
  socketId?: string;
  key?: string;
  collectionReference?: CollectionReference<StoreObj<T>>;
};
