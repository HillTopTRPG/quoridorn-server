import {bucket, s3Client, SYSTEM_COLLECTION, WebIfResister} from "../../server";
import Driver from "nekostore/lib/Driver";
import {sendError, setWebIfEvent} from "../../utility/server";
import {Request, Response} from "express";
import {RoomStore} from "../../@types/data";
import {getFileHash} from "../../utility/data";
import * as multer from "multer";


// インタフェース
const method = "post";
const path = "/v1/media";
const authenticationType = "user";


const upload = multer({
  storage: multer.memoryStorage()
}).array("file");

async function mediaPost(
  req: Request,
  res: Response,
  driver: Driver,
  _: any
): Promise<void> {
  console.log("mediaPost");

  upload(req, res, async (_err) => {
    const tokenInfo = req.body.tokenInfo;
    const fileName = req.body.fileName;
    if (tokenInfo) console.log(JSON.stringify(tokenInfo));
    const roomNo = parseInt(req.body.roomNo || "");

    if (isNaN(roomNo)) {
      return sendError(res, path, method, 400, "");
    }

    const c = driver.collection<StoreData<RoomStore>>(SYSTEM_COLLECTION.ROOM_LIST);
    const docSnap = (await c.where("order", "==", roomNo).get()).docs
      .filter(doc => doc.exists())[0];

    if (!docSnap || !docSnap.exists()) {
      return sendError(res, path, method, 406, "Room not found.");
    }

    await (req as any).files
      .map((file: any) => async () => {
        const buffer = file.buffer;
        const hash = getFileHash(buffer);
        console.log(fileName);
        console.log(hash);

        await s3Client!.putObject(bucket, fileName, buffer);
        console.log("###");
      })
      .reduce((prev: Promise<void>, curr: () => Promise<void>) => prev.then(curr), Promise.resolve());

    console.log("The End Before");
    res.json({result: true});
    console.log("The End after");
  });
}

const resist: WebIfResister = (webApp: any, driver: Driver, db: any): void => {
  setWebIfEvent(
    webApp,
    driver,
    method,
    path,
    authenticationType,
    (driver: Driver, req: Request, res: Response) => mediaPost(req, res, driver, db)
  );
};
export default resist;
