import {Resister, SYSTEM_COLLECTION} from "../server";
import {ApplicationError} from "../error/ApplicationError";
import {deleteTouchier, getRoomInfo, setEvent} from "./common";
import Driver from "nekostore/lib/Driver";
import {ReleaseTouchRequest} from "../@types/socket";

// インタフェース
const eventName = "release-touch-room";
type RequestType = ReleaseTouchRequest;
type ResponseType = void;

/**
 * 部屋（作成・編集・削除）キャンセル処理
 * @param driver
 * @param exclusionOwner
 * @param arg 部屋番号
 * @param updateForce
 */
export async function releaseTouchRoom(driver: Driver, exclusionOwner: string, arg: RequestType, updateForce?: boolean): Promise<ResponseType> {
  console.log(`START [releaseTouchRoom (${exclusionOwner}) no=${arg.roomNo}`);

  let docSnap;
  try {
    docSnap = await getRoomInfo(driver, arg.roomNo, {
      exclusionOwner,
    });
  } catch (err) {
    console.log(`ERROR [releaseTouchRoom (${exclusionOwner}) no=${arg.roomNo}`);
    throw err;
  }

  if (!docSnap) {
    console.log(`ERROR [releaseTouchRoom (${exclusionOwner}) no=${arg.roomNo}`);
    throw new ApplicationError(`Already released touch or created room. room-no=${arg.roomNo}`);
  }

  try {
    await deleteTouchier(driver, exclusionOwner, SYSTEM_COLLECTION.ROOM_LIST, docSnap.ref.id);
  } catch (err) {
    console.log(`ERROR [releaseTouchRoom (${exclusionOwner}) no=${arg.roomNo}`);
    throw err;
  }

  try {
    if (updateForce || docSnap.data!.data) {
      await docSnap.ref.update({
        exclusionOwner: null,
        status: "touched-released",
        updateTime: new Date()
      });
    } else {
      await docSnap.ref.delete();
    }
  } catch (err) {
    console.log(`ERROR [releaseTouchRoom (${exclusionOwner}) no=${arg.roomNo}`);
    throw err;
  }

  console.log(`END [releaseTouchRoom (${exclusionOwner}) no=${arg.roomNo}`);
}

const resist: Resister = (driver: Driver, socket: any): void => {
  setEvent<RequestType, ResponseType>(driver, socket, eventName, (driver: Driver, arg: RequestType) => releaseTouchRoom(driver, socket.id, arg));
};
export default resist;
