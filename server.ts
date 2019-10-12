import BasicDriver from "nekostore/lib/driver/basic";
import SocketDriverServer from "nekostore/lib/driver/socket/SocketDriverServer";

async function server(): Promise<() => void> {
  const driver = new BasicDriver();
  const server = require("socket.io").listen(2222);
  server.on("connection", (socket: any) => {
    console.log("Connected", socket.id);
    new SocketDriverServer(driver, socket);
  });

  return (): void => server.close();
}

server();