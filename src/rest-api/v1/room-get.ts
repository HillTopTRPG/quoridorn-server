import {SYSTEM_COLLECTION, WebIfResister} from "../../server";
import Driver from "nekostore/lib/Driver";
import {sendError, setWebIfEvent} from "../../utility/server";
import {Request, Response} from "express";
import {StoreObj} from "../../@types/store";
import {RoomStore, TokenStore} from "../../@types/data";

// インタフェース
const method = "get";
const path = "/v1/rooms/:roomNo";
const authenticationType = "room";

async function roomGet(
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

  // 正常終了
  await res.json({
    result: true,
    room: {
      roomNo: roomInfo.data!.order,
      name: roomInfo.data!.data!.name,
      memberNum: authorizedValue(roomInfo.data!.data!.memberNum),
      bcdiceServer: authorizedValue(roomInfo.data!.data!.bcdiceServer),
      system: authorizedValue(roomInfo.data!.data!.system),
      roomCollectionPrefix: authorizedValue(roomInfo.data!.data!.roomCollectionPrefix),
      storageId: authorizedValue(roomInfo.data!.data!.storageId),
      createTime: authorizedValue(roomInfo.data!.createTime),
      updateTime: authorizedValue(roomInfo.data!.updateTime)
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
    (driver: Driver, req: Request, res: Response) => roomGet(req, res, driver)
  );
};
export default resist;
