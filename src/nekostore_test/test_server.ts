import BasicDriver from "nekostore/lib/driver/basic";
import SocketDriverServer from "nekostore/lib/driver/socket/SocketDriverServer";

async function main(): Promise<void> {
  try {
    const driver = new BasicDriver();
    const io = require("socket.io").listen(8000);

    console.log("Quoridorn Server is Ready.");

    io.on("connection", (socket: any) => {
      console.log("Connected", socket.id);

      socket.on("disconnect", () => {
        console.log("disconnected", socket.id);
      });

      // nekostore起動！
      new SocketDriverServer(driver, socket);
    });
  } catch (err) {
    console.error(err);
  }
}

main();
