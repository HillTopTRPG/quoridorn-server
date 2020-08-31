import {SYSTEM_COLLECTION, WebIfResister} from "../../server";
import Driver from "nekostore/lib/Driver";
import {setWebIfEvent} from "../../utility/server";
import {Request, Response} from "express";
import {StoreObj} from "../../@types/store";
import {RoomStore, TokenStore} from "../../@types/data";

// インタフェース
const method = "get";
const path = "/v1/rooms";
const authenticationType = "empty";

async function roomsGet(
  req: Request,
  res: Response,
  driver: Driver
): Promise<void> {
  const tokenInfo = req.body.tokenInfo ? req.body.tokenInfo as TokenStore : null;
  const isAdmin = !!tokenInfo;
  const authorizedValue = (value: any) => isAdmin ? value : undefined;

  const c = driver.collection<StoreObj<RoomStore>>(SYSTEM_COLLECTION.ROOM_LIST);
  const roomInfoList = (await c.get()).docs
    .filter(doc => doc.exists());

  // 正常終了
  await res.json({
    result: true,
    rooms: roomInfoList.map(r => {
      if (!r.data!.data) {
        return {
          roomNo: r.data!.order
        }
      }
      return {
        roomNo: r.data!.order,
        name: r.data!.data!.name,
        memberNum: authorizedValue(r.data!.data!.memberNum),
        bcdiceServer: authorizedValue(r.data!.data!.bcdiceServer),
        system: authorizedValue(r.data!.data!.system),
        roomCollectionPrefix: authorizedValue(r.data!.data!.roomCollectionPrefix),
        storageId: authorizedValue(r.data!.data!.storageId),
        createTime: authorizedValue(r.data!.createTime),
        updateTime: authorizedValue(r.data!.updateTime)
      };
    })
  });
}

const resist: WebIfResister = (webApp: any, driver: Driver): void => {
  setWebIfEvent(
    webApp,
    driver,
    method,
    path,
    authenticationType,
    (driver: Driver, req: Request, res: Response) => roomsGet(req, res, driver)
  );
};
export default resist;
