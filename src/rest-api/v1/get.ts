import {WebIfResister} from "../../server";
import Driver from "nekostore/lib/Driver";
import {setWebIfEvent} from "../../utility/server";
import {Request, Response} from "express";

// インタフェース
const method = "get";
const path = "/v1";
const authenticationType = "none";

async function infoGet(_: Request, res: Response): Promise<void> {
  // 正常終了
  await res.json({
    result: true,
    type: "Quoridorn Web IF",
    version: "Ver.1.0.0"
  });
}

const resist: WebIfResister = (webApp: any, driver: Driver): void => {
  setWebIfEvent(
    webApp,
    driver,
    method,
    path,
    authenticationType,
    (_driver: Driver, req: Request, res: Response) => infoGet(req, res)
  );
};
export default resist;
