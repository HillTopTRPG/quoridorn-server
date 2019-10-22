import Driver from "nekostore/lib/Driver";
import DocumentSnapshot from "nekostore/lib/DocumentSnapshot";
import {StoreMetaData, StoreObj} from "../@types/store";
import {RoomSecretInfo} from "../@types/server";
import {SYSTEM_COLLECTION} from "../server";
import {SystemError} from "../error/SystemError";
import {RoomInfo} from "../@types/room";
import {ApplicationError} from "../error/ApplicationError";

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

type GetRoomInfoOption = {
  exclusionOwner?: string;
};

/**
 * 部屋情報コレクションから特定の部屋の情報を取得する
 * @param driver
 * @param roomNo
 * @param option
 */
export async function getRoomInfo(
  driver: Driver,
  roomNo: number,
  option: GetRoomInfoOption = {}
): Promise<DocumentSnapshot<StoreObj<RoomInfo>> | null> {
  const roomDocList = (await driver.collection<StoreObj<RoomInfo>>(SYSTEM_COLLECTION.ROOM_LIST)
    .where("order", "==", roomNo)
    .get()
  ).docs;

  if (!roomDocList.length) return null;

  // 部屋情報が複数件取得できてしまった場合
  // 仕様上考慮しなくていいとされてきたuuidが重複してしまった本当の想定外エラー
  if (roomDocList.length > 1)
    throw new SystemError(`Duplicate room info. Please report to server administrator. room-no=${roomNo}`);

  const doc = roomDocList[0];
  const data = doc.data;

  // 排他チェック
  if (option.exclusionOwner) {
    if (!data.exclusionOwner) throw new ApplicationError(`Illegal operation. room-no=${roomNo}`);
    if (data.exclusionOwner !== option.exclusionOwner) throw new ApplicationError(`Other player touched. room-no=${roomNo}`);
  }

  return roomDocList[0];
}

/**
 * シークレットコレクション（部屋情報）から特定の部屋の情報を取得する
 * @param driver
 * @param roomNo
 * @param roomId
 */
export async function getSecretRoomInfo(
  driver: Driver,
  roomNo: number,
  roomId: string
): Promise<RoomSecretInfo> {
  const roomSecretDocList = (await driver.collection<RoomSecretInfo>(SYSTEM_COLLECTION.ROOM_SECRET)
    .where("roomId", "==", roomId)
    .get()
  ).docs;

  // 部屋一覧に部屋情報はあるのに、シークレット部屋情報が存在しない場合
  // → サーバ管理者が手動でレコードを消した以外にはあり得ない
  // ※ 前段の部屋存在チェックにて、新規部屋作成前のtouch-room状態ではないことは確認済み
  if (!roomSecretDocList.length)
    throw new SystemError(`No such room secret info. Please report to server administrator. room-no=${roomNo}, room-id=${roomId}`);

  // シークレット部屋情報が複数件取得できてしまった場合
  // 仕様上考慮しなくていいとされてきたuuidが重複してしまった本当の想定外エラー
  if (roomSecretDocList.length > 1)
    throw new SystemError(`Duplicate room secret info. Please report to server administrator. room-no=${roomNo}, room-id=${roomId}`);

  return roomSecretDocList[0].data;
}
