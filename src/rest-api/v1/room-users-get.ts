import {SYSTEM_COLLECTION, WebIfResister} from "../../server";
import Driver from "nekostore/lib/Driver";
import {sendError, setWebIfEvent} from "../../utility/server";
import {Request, Response} from "express";
import {StoreObj} from "../../@types/store";
import {RoomStore, TokenStore, UserStore} from "../../@types/data";

// インタフェース
const method = "get";
const path = "/v1/rooms/:roomNo/users";
const authenticationType = "room";

async function roomUsersGet(
  req: Request,
  res: Response,
  driver: Driver
): Promise<void> {
  const tokenInfo = req.body.tokenInfo ? req.body.tokenInfo as TokenStore : null;
  if (!tokenInfo) {
    return sendError(res, path, method, 401, "Need token.");
  }
  const isAdmin = tokenInfo.type === "server";
  const authorizedValue = (value: any) => isAdmin ? value : undefined;

  const roomNo = parseInt(req.params.roomNo || "");
  if (isNaN(roomNo)) {
    return sendError(res, path, method, 400, "");
  }

  if (!isAdmin) {
    if (tokenInfo.roomNo !== roomNo) {
      return sendError(res, path, method, 406, "Different room.");
    }
  }

  const c = driver.collection<StoreObj<RoomStore>>(SYSTEM_COLLECTION.ROOM_LIST);
  const roomInfo = (await c.where("order", "==", roomNo).get()).docs
    .filter(doc => doc.exists())[0];

  if (!roomInfo) {
    return sendError(res, path, method, 406, "Room not found.");
  }

  const roomCollectionPrefix = roomInfo.data!.data!.roomCollectionPrefix;
  const roomUserCollectionName = `${roomCollectionPrefix}-DATA-user-list`;
  const userCollection = driver.collection<StoreObj<UserStore>>(roomUserCollectionName);
  const userDocList = (await userCollection.get()).docs
    .filter(doc => doc.exists());

  // 正常終了
  await res.json({
    result: true,
    users: userDocList.map(u => ({
      roomNo,
      userId: u.ref.id,
      name: u.data!.data!.name,
      type: u.data!.data!.type,
      login: authorizedValue(u.data!.data!.login),
      createTime: authorizedValue(u.data!.createTime),
      updateTime: authorizedValue(u.data!.updateTime),
    }))
  });
}

const resist: WebIfResister = (webApp: any, driver: Driver): void => {
  setWebIfEvent(
    webApp,
    driver,
    method,
    path,
    authenticationType,
    (driver: Driver, req: Request, res: Response) => roomUsersGet(req, res, driver)
  );
};
export default resist;
