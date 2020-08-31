import {WebIfResister} from "../../server";
import Driver from "nekostore/lib/Driver";
import {sendError, setWebIfEvent} from "../../utility/server";
import {Request, Response} from "express";

// インタフェース
const method = "post";
const path = "/v1/rooms/:roomNo/chat";
const authenticationType = "room";

async function roomChatPost(
  _req: Request,
  res: Response
): Promise<void> {
  return sendError(res, path, method, 405, "");
  // const tokenInfo = req.body.tokenInfo as TokenStore;
  // const roomNoStr = req.params.roomNo;
  //
  // if (!roomNoStr) {
  //   res.sendStatus(400);
  //   return;
  // }
  //
  // const roomNo = parseInt(roomNoStr);
  // if (isNaN(roomNo)) {
  //   res.sendStatus(400);
  //   return;
  // }
  //
  // if (tokenInfo.roomNo !== roomNo) {
  //   res.status(406).send("Different room.");
  //   return;
  // }
  //
  // driver.toString();
  //
  // // 正常終了
  // await res.json({
  //   result: true,
  //   chatId: ""
  // });
}

const resist: WebIfResister = (webApp: any, driver: Driver): void => {
  setWebIfEvent(
    webApp,
    driver,
    method,
    path,
    authenticationType,
    (_driver: Driver, req: any, res: any) => roomChatPost(req, res)
  );
};
export default resist;
