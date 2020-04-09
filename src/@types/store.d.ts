export type StoreObj<T> = {
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

export type PermissionNode = {
  type: "group" | "actor" | "owner";
  id?: string;
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
