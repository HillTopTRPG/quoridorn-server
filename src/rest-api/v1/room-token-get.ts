import {hashAlgorithm, SYSTEM_COLLECTION, WebIfResister} from "../../server";
import Driver from "nekostore/lib/Driver";
import {generateToken, sendError, setWebIfEvent} from "../../utility/server";
import {Request, Response} from "express";
import {StoreObj} from "../../@types/store";
import {RoomStore, TokenStore} from "../../@types/data";
import {verify} from "../../utility/password";

// インタフェース
const method = "get";
const path = "/v1/rooms/:roomNo/token";
const authenticationType = "room";

async function roomTokenGet(
  req: Request,
  res: Response,
  driver: Driver
): Promise<void> {
  const roomNo = parseInt(req.params.roomNo || "");
  if (isNaN(roomNo)) {
    return sendError(res, path, method, 400, "");
  }

  const c = driver.collection<StoreObj<RoomStore>>(SYSTEM_COLLECTION.ROOM_LIST);
  const roomInfo = (await c.where("order", "==", roomNo).get()).docs
    .filter(doc => doc.exists())[0];

  if (!roomInfo) {
    return sendError(res, path, method, 406, "Room not found.");
  }

  const tokenInfo = req.body.tokenInfo ? req.body.tokenInfo as TokenStore : null;
  const isAdmin = !!tokenInfo;

  if (!isAdmin) {
    const roomPassword = req.headers.authorization!;
    const hashPassword = roomInfo.data!.data!.roomPassword;

    // 部屋パスワードチェック
    try {
      if (!await verify(hashPassword, roomPassword, hashAlgorithm)) {
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
      "room",
      roomNo,
      roomInfo.data!.data!.roomCollectionPrefix,
      roomInfo.data!.data!.storageId,
      null
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
    (driver: Driver, req: Request, res: Response) => roomTokenGet(req, res, driver)
  );
};
export default resist;
