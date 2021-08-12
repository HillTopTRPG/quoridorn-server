import {hashAlgorithm, SYSTEM_COLLECTION, WebIfResister} from "../../server";
import Driver from "nekostore/lib/Driver";
import {generateToken, sendError, setWebIfEvent} from "../../utility/server";
import {Request, Response} from "express";
import {RoomStore, TokenStore} from "../../@types/data";
import {verify} from "../../utility/password";
import {findSingle} from "../../utility/collection";

// インタフェース
const method = "get";
const path = "/v1/rooms/:roomNo/users/:userKey/token";
const authenticationType = "room";

async function roomUserTokenGet(
  req: Request,
  res: Response,
  driver: Driver
): Promise<void> {
  const tokenInfo = req.body.tokenInfo ? req.body.tokenInfo as TokenStore : null;
  if (!tokenInfo) {
    return sendError(res, path, method, 401, "Need token.");
  }
  const isAdmin = tokenInfo.type === "server";

  const roomNo = parseInt(req.params.roomNo || "");
  const userKey = req.params.userKey;
  const authorization = req.headers.authorization!;

  if (isNaN(roomNo) || !userKey) {
    return sendError(res, path, method, 400, "");
  }

  let userPassword: string | null = null;
  if (!isAdmin) {
    if (!authorization.match("/")) {
      return sendError(res, path, method, 401, "Need password.");
    }
    if (tokenInfo.roomNo !== roomNo) {
      return sendError(res, path, method, 406, "Different room.");
    }

    userPassword = authorization.replace(/^[^\/]+?\//, "");
  }

  const roomCollection = driver.collection<StoreData<RoomStore>>(SYSTEM_COLLECTION.ROOM_LIST);
  const roomInfo = (await roomCollection.where("order", "==", roomNo).get()).docs
    .filter(doc => doc.exists())[0];
  if (!roomInfo) {
    return sendError(res, path, method, 406, "Room not found.");
  }

  const roomCollectionPrefix = roomInfo.data!.data!.roomCollectionPrefix;
  const userDoc = (await findSingle<StoreData<UserStore>>(
    driver,
    `${roomCollectionPrefix}-DATA-user-list`,
    "key",
    userKey
  ));

  if (!userDoc || !userDoc.exists()) {
    return sendError(res, path, method, 406, "User not found.");
  }

  if (!isAdmin) {
    const hashPassword = userDoc.data!.data!.password;
    try {
      if (!await verify(hashPassword, userPassword!, hashAlgorithm)) {
        return sendError(res, path, method, 401, "Wrong password.");
      }
    } catch (err) {
      return sendError(res, path, method, 500, "Verify process fatal error.");
    }
  }

  // 正常終了
  await res.json({
    result: true,
    ...await generateToken(
      driver,
      "user",
      roomInfo.data!.order,
      roomInfo.data!.data!.roomCollectionPrefix!,
      roomInfo.data!.data!.storageId,
      userKey
    )
  });
}

const resist: WebIfResister = (webApp: any, driver: Driver): void => {
  setWebIfEvent(
    webApp,
    driver,
    method,
    path,
    authenticationType,
    (driver: Driver, req: Request, res: Response) => roomUserTokenGet(req, res, driver)
  );
};
export default resist;
