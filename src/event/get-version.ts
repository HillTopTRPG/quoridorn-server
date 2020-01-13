import {
  GetVersionResponse
} from "../@types/socket";
import {getMessage, Resister, targetClient, version} from "../server";
import {setEvent} from "./common";
import Driver from "nekostore/lib/Driver";

// インタフェース
const eventName = "get-version";
type RequestType = never;
type ResponseType = GetVersionResponse;

/**
 * サーバのバージョン番号を返却する
 */
async function getVersion(): Promise<ResponseType> {
  const message = getMessage();
  return {
    version,
    title: message.title,
    targetClient: targetClient
  }
}

const resist: Resister = (driver: Driver, socket: any): void => {
  setEvent<RequestType, ResponseType>(driver, socket, eventName, getVersion);
};
export default resist;
