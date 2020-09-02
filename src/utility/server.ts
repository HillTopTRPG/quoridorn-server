import {UploadMediaInfo} from "../@types/socket";
import {accessLog, accessLogForWebApi, errorLog, errorLogForWebApi} from "./logger";
import Driver from "nekostore/lib/Driver";
import {Permission} from "../@types/store";
import {TokenStore} from "../@types/data";
import {serverSetting, SYSTEM_COLLECTION} from "../server";
import {Request, Response, NextFunction} from "express";
const uuid = require("uuid");

/**
 * リクエスト処理を登録するための関数。
 * @param driver
 * @param socket
 * @param eventName
 * @param func
 */
export function setEvent<T, U>(driver: Driver, socket: any, eventName: string, func: (driver: Driver, arg: T, permission?: Permission) => Promise<U>) {
  const resultEvent = `result-${eventName}`;
  socket.on(eventName, async (arg: T) => {
    const logArg = arg ? JSON.parse(JSON.stringify(arg)) : null;
    if (eventName === "upload-media") {
      logArg.uploadMediaInfoList.forEach((info: UploadMediaInfo) => {
        info.imageSrc = "[Binary Array]";
        if (info.dataLocation === "server") {
          delete info.blob;
          delete info.arrayBuffer;
        }
      });
    }
    accessLog(socket.id, eventName, "START", logArg);
    try {
      const result = await func(driver, arg);
      accessLog(socket.id, eventName, "END  ", result);
      socket.emit(resultEvent, null, result);
    } catch (err) {
      // アクセスログは必ず閉じる
      accessLog(socket.id, eventName, "ERROR");

      // エラーの内容はエラーログを見て欲しい（アクセスログはシンプルにしたい）
      const errorMessage = "message" in err ? err.message : err;
      errorLog(socket.id, eventName, errorMessage);

      socket.emit(resultEvent, err, null);
    }
  });
}

export class HttpError extends Error {
  constructor(public statusCode: number, public message: string) {
    super(message);
  }
}

export function sendError(
  res: Response,
  path: string,
  method: string,
  status: number,
  message: string
): void {
  errorLogForWebApi(path, method, status, message);
  res.status(status || 500).send(message);
}

/**
 * WebIfリクエスト処理を登録するための関数。
 * @param webApp
 * @param driver
 * @param method
 * @param path
 * @param authenticationType
 * @param func
 */
export function setWebIfEvent(
  webApp: any,
  driver: Driver,
  method: "get" | "post" | "delete",
  path: string,
  authenticationType: "none" | "empty" | "server" | "room" | "user",
  func: (driver: Driver, req: Request, res: Response) => Promise<void>
) {
  // フルパスを生成
  const pathParts: string[] = [];
  if (!serverSetting.webApiPathBase.startsWith("/")) pathParts.push("/");
  pathParts.push(serverSetting.webApiPathBase);
  if (!serverSetting.webApiPathBase.endsWith("/") && !path.startsWith("/")) pathParts.push("/");
  if (serverSetting.webApiPathBase.endsWith("/") && path.startsWith("/")) path = path.replace(/^\//, "");
  pathParts.push(path);
  if (!path.endsWith("/")) pathParts.push("/");

  const callFuncList: ((req: any, res: any, next: NextFunction) => Promise<void>)[] = [saveAccessLog.bind(null, method.toString())];
  if (authenticationType !== "none") callFuncList.push(requireToken.bind(null, driver, authenticationType));

  webApp[method](
    pathParts.join(""),
    ...callFuncList,
    func.bind(null, driver)
  );
}

async function saveAccessLog(
  method: string,
  req: Request,
  _: Response,
  next: NextFunction
) {
  accessLogForWebApi(req.url, method, req.get("Authorization"));
  next();
}

/* アクセスにJWTトークンを要求する */
async function requireToken(
  driver: Driver,
  authenticationType: "empty" | "server" | "room" | "user",
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (!req.headers || req.get("Authorization") === undefined) {
    authenticationType === "empty"
      ? next()
      : res.sendStatus(400);
    return;
  }
  const authorization = req.headers.authorization!;

  const matchResult = authorization.match(/^Bearer\s(.+)$/);
  if (!matchResult) {
    authenticationType === "room"
      ? next()
      : res.status(401).send(`Need token.`);
    return;
  }

  const token = matchResult[1].replace(/\/.*$/, "");
  const tokenInfo = await verifyToken(driver, authenticationType, token);

  if (typeof tokenInfo === "string") {
    res.status(401).send(tokenInfo);
    return;
  }
  req.body.tokenInfo = tokenInfo;
  next();
}

/* トークンが正しいか検証する。 */
async function verifyToken(driver: Driver, authenticationType: "empty" | "server" | "room" | "user", token: string): Promise<TokenStore | string> {
  const c = driver.collection<TokenStore>(SYSTEM_COLLECTION.TOKEN_LIST);
  const tokenDoc = (await c.where("token", "==", token).get()).docs[0];

  if (!tokenDoc || !tokenDoc.exists()) return `Invalid token. ${token}`;
  if (tokenDoc.data!.expires.getTime() < new Date().getTime()) {
    // 有効期限が過ぎていたら削除
    await tokenDoc.ref.delete();
    return "Expired token.";
  }

  const type = tokenDoc.data!.type;

  switch (authenticationType) {
    case "empty": // non-break
    case "server":
      if (type !== "server")
        return `Different types token. Need server Token.`;
      break;
    default:
      if (type !== authenticationType && type !== "server")
        return `Different types token. Need ${authenticationType.toString()} Token.`;
  }

  return tokenDoc.data!;
}

/* トークンを生成する */
export async function generateToken(
  driver: Driver,
  type: "server" | "room" | "user",
  roomNo: number | null,
  roomCollectionPrefix: string | null,
  storageId: string | null,
  userId: string | null
): Promise<{ token: string; expires: Date}> {
  const token = uuid.v4();
  const expires = new Date();
  expires.setSeconds(expires.getSeconds() + serverSetting.webApiTokenExpires);
  await driver.collection<TokenStore>(SYSTEM_COLLECTION.TOKEN_LIST).add({
    type,
    token,
    roomNo,
    roomCollectionPrefix,
    storageId,
    userId,
    expires
  });
  return { token, expires };
}
