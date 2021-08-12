import {WebIfResister} from "../../server";
import Driver from "nekostore/lib/Driver";
import {setWebIfEvent} from "../../utility/server";
import {Request, Response} from "express";
import * as moment from 'moment';
import {executeArchiveDownload} from "../../utility/file-util";
import {getAllCollection} from "../../utility/data";
import {findList, splitCollectionName} from "../../utility/collection";
import fetch from 'node-fetch';

// インタフェース
const method = "get";
const path = "/v1/room";
const authenticationType = "user";

async function downloadRoom(
  req: Request,
  res: Response,
  driver: Driver,
  _: any
): Promise<void> {
  console.log("downloadRoom");
  const tokenInfo = req.body.tokenInfo;

  const allCollection = await getAllCollection(driver, tokenInfo.roomCollectionPrefix);

  await executeArchiveDownload(
    res,
    `${process.cwd()}/${moment().format('YYYYMMDDHHmmss')}.zip`,
    async archive => {
      await allCollection
        .map(ccName => async () => {
          const { roomCollectionSuffix } = splitCollectionName(ccName);
          const dataList = (await findList<any>(driver, ccName))
            .map(doc => doc.exists() ? doc.data : null)
            .filter(data => data);
          const dataStr = JSON.stringify(dataList);
          archive.append(dataStr, { name: `json/${roomCollectionSuffix}.json` });

          if (roomCollectionSuffix === "media-list") {
            await dataList
              .filter((d: StoreData<MediaStore>) => {
                return d.data!.dataLocation === "server";
              })
              .map((d: StoreData<MediaStore>) => async () => {
                archive.append(
                  await (await fetch(d.data!.url)).buffer(),
                  { name: `media/${d.data!.mediaFileId}` }
                );
              })
              .reduce((prev, curr) => prev.then(curr), Promise.resolve());
          }
        })
        .reduce((prev, curr) => prev.then(curr), Promise.resolve());
    }
  );
}

const resist: WebIfResister = (webApp: any, driver: Driver, db: any): void => {
  setWebIfEvent(
    webApp,
    driver,
    method,
    path,
    authenticationType,
    (driver: Driver, req: Request, res: Response) => downloadRoom(req, res, driver, db)
  );
};
export default resist;
