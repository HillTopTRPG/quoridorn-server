import {SYSTEM_COLLECTION, WebIfResister} from "../../server";
import Driver from "nekostore/lib/Driver";
import {sendError, setWebIfEvent} from "../../utility/server";
import {Request, Response} from "express";
import {StoreObj} from "../../@types/store";
import {RoomStore} from "../../@types/data";
import {doDeleteRoom} from "../../utility/data-room";

// インタフェース
const method = "delete";
const path = "/v1/rooms/:roomNo";
const authenticationType = "server";

async function roomDelete(
  req: Request,
  res: Response,
  driver: Driver,
  db: any
): Promise<void> {
  const roomNo = parseInt(req.params.roomNo || "");
  if (isNaN(roomNo)) {
    return sendError(res, path, method, 400, "");
  }

  const c = driver.collection<StoreObj<RoomStore>>(SYSTEM_COLLECTION.ROOM_LIST);
  const docSnap = (await c.where("order", "==", roomNo).get()).docs
    .filter(doc => doc.exists())[0];

  if (!docSnap || !docSnap.exists()) {
    return sendError(res, path, method, 406, "Room not found.");
  }

  doDeleteRoom(driver, db, docSnap)
    .then(() => {
      res.json({
        result: true
      });
    })
    .catch(() => {
      sendError(res, path, method, 500, "");
    });
}

const resist: WebIfResister = (webApp: any, driver: Driver, db: any): void => {
  setWebIfEvent(
    webApp,
    driver,
    method,
    path,
    authenticationType,
    (driver: Driver, req: Request, res: Response) => roomDelete(req, res, driver, db)
  );
};
export default resist;
