import {
  GetVersionResponse
} from "../@types/socket";
import {Resister, version} from "../server";
import {setEvent} from "./common";
import Driver from "nekostore/lib/Driver";
import {message} from "./get-room-list";

// インタフェース
const eventName = "get-version";
type RequestType = never;
type ResponseType = GetVersionResponse;

/**
 * サーバのバージョン番号を返却する
 */
async function getVersion(): Promise<ResponseType> {
  return {
    version,
    title: message.title
  }
}

const resist: Resister = (driver: Driver, socket: any): void => {
  setEvent<RequestType, ResponseType>(driver, socket, eventName, getVersion);
};
export default resist;
