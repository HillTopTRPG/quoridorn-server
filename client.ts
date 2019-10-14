import Nekostore from "nekostore";
import SocketDriver from "nekostore/lib/driver/socket";
import * as Socket from "socket.io-client";
import moment from "moment";

const host = "127.0.0.1";
const port = 2222;

async function client(): Promise<void> {
  const socket = Socket.connect(`http://${host}:${port}`);

  const driver = new SocketDriver({ socket });
  const nekostore = new Nekostore(driver);

  const c1Ref = nekostore.collection<any>("c1");

  const unsubscribe1 = await c1Ref.onSnapshot(snapshot => {
    snapshot.docs.forEach(doc => {
      console.log(
        doc.ref.id,
        doc.type,
        doc.data,
        moment(doc.createTime.toDate()).format("YYYY/MM/DD HH:mm:ss"),
        moment(doc.updateTime.toDate()).format("YYYY/MM/DD HH:mm:ss")
      );
    });
  });


  const d1Ref = await c1Ref.doc("d1");
  await d1Ref.set({ foo: "a", bar: 0 });

  await unsubscribe1();
  socket.disconnect();
}
client().then(() => {}, err => {
  console.error(err);
  process.exit(err);
});
