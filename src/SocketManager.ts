import * as events from "events";

export default class SocketManager {
  // シングルトン
  public static get instance(): SocketManager {
    if (!SocketManager._instance) SocketManager._instance = new SocketManager();
    return SocketManager._instance;
  }

  private static _instance: SocketManager;

  private readonly __socket: events.EventEmitter;

  // コンストラクタの隠蔽
  private constructor() {
    this.__socket = require("socket.io").listen(2222);
  }
}