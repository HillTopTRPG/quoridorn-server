import {serverSetting, WebIfResister} from "../../server";
import Driver from "nekostore/lib/Driver";
import {generateToken, sendError, setWebIfEvent} from "../../utility/server";
import {Request, Response} from "express";

// インタフェース
const method = "get";
const path = "/v1/token";
const authenticationType = "none";

async function tokenGet(
  req: Request,
  res: Response,
  driver: Driver
): Promise<void> {
  const serverPassword = req.headers.authorization;

  if (serverPassword === undefined) {
    return sendError(res, path, method, 400, "");
  }

  if (serverSetting.webApiPassword !== serverPassword) {
    return sendError(res, path, method, 401, "Wrong server password.");
  }

  // 正常終了
  await res.json({
    result: true,
    ...await generateToken(
      driver,
      "server",
      null,
      null,
      null,
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
    (driver: Driver, req: Request, res: Response) => tokenGet(req, res, driver)
  );
};
export default resist;
