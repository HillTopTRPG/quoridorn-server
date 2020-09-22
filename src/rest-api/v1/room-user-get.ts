import {SYSTEM_COLLECTION, WebIfResister} from "../../server";
import Driver from "nekostore/lib/Driver";
import {sendError, setWebIfEvent} from "../../utility/server";
import {Request, Response} from "express";
import {StoreObj} from "../../@types/store";
import {RoomStore, TokenStore, UserStore} from "../../@types/data";
import {findSingle} from "../../utility/collection";

// インタフェース
const method = "get";
const path = "/v1/rooms/:roomNo/users/:userKey";
const authenticationType = "user";

async function roomUserGet(
  req: Request,
  res: Response,
  driver: Driver
): Promise<void> {
  const tokenInfo = req.body.tokenInfo as TokenStore;
  const isAdmin = tokenInfo.type === "server";
  const authorizedValue = (value: any) => isAdmin ? value : undefined;

  const userKey = req.params.userKey;
  const roomNo = parseInt(req.params.roomNo || "");
  if (isNaN(roomNo)) {
    return sendError(res, path, method, 400, "");
  }

  if (!isAdmin) {
    if (tokenInfo.roomNo !== roomNo) {
      return sendError(res, path, method, 406, "Different room.");
    }

    if (tokenInfo.userKey !== userKey) {
      return sendError(res, path, method, 406, "Different user.");
    }
  }

  const c = driver.collection<StoreObj<RoomStore>>(SYSTEM_COLLECTION.ROOM_LIST);
  const roomInfo = (await c.where("order", "==", roomNo).get()).docs
    .filter(doc => doc.exists())[0];

  if (!roomInfo) {
    return sendError(res, path, method, 406, "Room not found.");
  }

  const roomCollectionPrefix = tokenInfo.roomCollectionPrefix;
  const userDoc = (await findSingle<StoreObj<UserStore>>(
    driver,
    `${roomCollectionPrefix}-DATA-user-list`,
    "key",
    userKey
  ));

  if (!userDoc || !userDoc.exists()) {
    return sendError(res, path, method, 406, "User not found.");
  }

  // 正常終了
  await res.json({
    result: true,
    users: {
      roomNo,
      userKey: userDoc.data.key,
      name: userDoc.data.data!.name,
      type: userDoc.data.data!.type,
      login: authorizedValue(userDoc.data.data!.login),
      createTime: authorizedValue(userDoc.data.createTime),
      updateTime: authorizedValue(userDoc.data.updateTime),
    }
  });
}

const resist: WebIfResister = (webApp: any, driver: Driver): void => {
  setWebIfEvent(
    webApp,
    driver,
    method,
    path,
    authenticationType,
    (driver: Driver, req: Request, res: Response) => roomUserGet(req, res, driver)
  );
};
export default resist;
