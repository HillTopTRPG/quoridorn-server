export class ApplicationError implements Error {
  /**
   * メッセージを生成する
   * @param detail
   * @param args
   */
  private static createMessage(
    // socketId: string | null,
    // eventName: string | null,
    detail: string,
    args?: {[key: string]: any}
  ): string {
    let argStr: string = args ? JSON.stringify(args) : "";
    // パスワードはマスクする
    argStr = argStr.replace(/([pP]assword[^:]*":)"[^"]*"/g, (_m: string, p1: string) => `${p1}"***"`);
    // return `[socketId:${socketId}] [${eventName}] detail: "${detail}" ${argStr}`;
    return `"${detail}" ${argStr}`;
  }

  public name: "ApplicationError" = "ApplicationError";
  public message: string;

  constructor(
    public readonly detail: string,
    public readonly args?: {[key: string]: any}
  ) {
    this.message = ApplicationError.createMessage(detail, args);
  }

  // public set socketId(socketId: string) {
  //   if (this.__socketId !== null) return;
  //   this.__socketId = socketId;
  //   this.message = ApplicationError.createMessage(socketId, this.__eventName, this.detail, this.args);
  // }
  //
  // public set eventName(eventName: string) {
  //   if (this.__eventName !== null) return;
  //   this.message = ApplicationError.createMessage(this.__socketId, eventName, this.detail, this.args);
  // }

  public toString() {
    return `${this.name}: ${this.message}`;
  }
}