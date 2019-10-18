import Nekostore from "nekostore";
import SocketDriver from "nekostore/lib/driver/socket";
import moment from "moment";
import * as Socket from 'socket.io-client';

const host = "127.0.0.1";
const port = 8000;

interface Data {
  foo: string;
  bar?: number;
}

async function test_client(): Promise<void> {
  const socket = Socket.connect(`http://${host}:${port}`);

  const driver = new SocketDriver({ socket });
  const nekostore = new Nekostore(driver);

  const c1Ref = nekostore.collection<Data>("c1");

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
  // socket.disconnect();
}

test_client().then(() => {}, err => {
  console.log(err);
  process.exit(err);
});
