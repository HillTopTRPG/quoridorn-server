import Nekostore from "nekostore";
import SocketDriver from "nekostore/lib/driver/socket";
import * as Socket from "socket.io-client";
import QuerySnapshot from "nekostore/lib/QuerySnapshot";

// const host = "http://127.0.0.1";
const host = "wss://quori-dev.onlinesession.app";
// const port = 8000;

interface Data {
  foo: string;
  bar?: number;
}

async function test_client(): Promise<void> {
  const socket = Socket.connect(`${host}`); // :${port}

  socket.on("connect", () => {
    console.log("connected");
  });

  socket.on("connect_timeout", () => {
    console.log("connect_timeout");
  });

  socket.on("connect_error", (err) => {
    console.log("connect_error", err);
  });

  const driver = new SocketDriver({ socket, timeout: 5000 });
  const nekostore = new Nekostore(driver);

  console.log("Go Go Go!!!");

  const c1Ref = nekostore.collection<Data>("c1");

  c1Ref.onSnapshot((snapshot: QuerySnapshot<Data>) => {
    snapshot.docs.forEach(async doc => {
      const docSnapshot = await doc.ref.get();
      if (docSnapshot.exists()) {
        console.log(doc.data);
      }
    });
  });

  // collectionに対する何らかの関数を呼ぶとエラー
  c1Ref.add({
    foo: "Hello World."
  });
}

test_client().then(() => {}, err => {
  console.error(err.stack);
  process.exit(err);
});
