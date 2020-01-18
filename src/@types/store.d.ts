export type StoreObj<T> = {
  order: number;
  exclusionOwner: string | null; // 排他制御のオーナー
  owner: string | null;
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
  type: "group" | "user" | "character" | "owner";
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
