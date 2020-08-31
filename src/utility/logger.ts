const log4js = require('log4js');
log4js.configure("./config/log4js_setting.json");

export function accessLog(socketId: string, eventName: string, category?: string, arg?: any) {
  const logger = log4js.getLogger("access");
  let argStr: string;
  if (arg === undefined) argStr = "";
  else if (arg === null) argStr = "null";
  else if (Array.isArray(arg) || typeof arg === "object") {
    argStr = JSON.stringify(arg);
    // パスワードはマスクする
    argStr = argStr.replace(/([pP]assword[^:]*":)"[^"]*"/g, (_m: string, p1: string) => `${p1}"***"`);
  } else argStr = arg.toString();
  const categoryStr = category ? ` [${category}]` : "";
  logger.info(`[socketId:${socketId}]${categoryStr} ${eventName} ${argStr}`);
}

export function accessLogForWebApi(path: string, method: string, authorization: string | undefined) {
  const logger = log4js.getLogger("access");
  logger.info(`[${method}] ${path} Authorization: ${authorization}`);
}

export function errorLog(socketId: string, eventName: string, message: string) {
  const logger = log4js.getLogger("error");
  logger.error(`[socketId:${socketId}] ${eventName} ${message}`);
}

export function errorLogForWebApi(path: string, method: string, status: number, message: string) {
  const logger = log4js.getLogger("error");
  logger.error(`[${method}] ${path} status: ${status} msg: ${message}`);
}
