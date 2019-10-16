import Driver from "nekostore/lib/Driver";
import DocumentSnapshot from "nekostore/lib/DocumentSnapshot";
import {StoreMetaData, StoreObj} from "../@types/store";

export function setEvent<T, U>(driver: Driver, socket: any, event: string, func: (driver: Driver, arg: T) => Promise<U>) {
  const resultEvent = `result-${event}`;
  socket.on(event, async (arg: T) => {
    try {
      socket.emit(resultEvent, null, await func(driver, arg));
    } catch(err) {
      console.error(err);
      socket.emit(resultEvent, err, null);
    }
  });
}

export function getStoreObj<T>(
  doc: DocumentSnapshot<StoreObj<T>>
): (StoreObj<T> & StoreMetaData) | null {
  if (doc.exists()) {
    const data: StoreObj<T> = doc.data;
    return {
      ...data,
      id: doc.ref.id,
      createTime: doc.createTime ? doc.createTime.toDate() : null,
      updateTime: doc.updateTime ? doc.updateTime.toDate() : null
    };
  } else {
    return null;
  }
}
