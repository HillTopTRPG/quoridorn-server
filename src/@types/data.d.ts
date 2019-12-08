export type TouchRequest = {
  collection: string;
  id?: string;
};
export type TouchModifyRequest = TouchRequest & {
  id: string;
};
export type ReleaseTouchRequest = TouchModifyRequest

export type CreateDataRequest = TouchModifyRequest & {
  order?: number;
  data: any;
};
export type DeleteDataRequest = TouchModifyRequest;
export type UpdateDataRequest = CreateDataRequest;
