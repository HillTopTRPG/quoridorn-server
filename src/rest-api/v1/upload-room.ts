import {WebIfResister} from "../../server";
import Driver from "nekostore/lib/Driver";
import {setWebIfEvent} from "../../utility/server";
import {Request, Response} from "express";
import * as Path from "path";
import * as fs from "fs";
import * as multer from "multer";
const nodeZip = require('node-zip');
import * as fse from "fs-extra";
import * as YAML from "yaml";

// インタフェース
const method = "post";
const path = "/v1/room";
const authenticationType = "none";

const upload =
  multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => {
        cb(null, `${process.cwd()}/uploads`);
      },
      filename: (_req, file, cb) => {
        cb(null, `${file.fieldname}-${Date.now()}${Path.extname(file.originalname)}`);
      }
    })
  }).single("zipFile");

const unzipFile = (fullPath: string): string => {
  const baseFolderPath = `${process.cwd()}/uploads/${Path.basename(fullPath, Path.extname(fullPath))}`;
  const data = fs.readFileSync(fullPath);
  const zip = nodeZip(data, {base64: false}); // , checkCRC32: true
  Object.keys(zip.files).forEach(filePath => {
    console.log(filePath);
    console.log(zip.files[filePath].data);
    console.log(zip.files[filePath].buffer);
    console.log(zip.files[filePath].stream);
    console.log(zip.files[filePath]);
    console.log();
    zip.files[filePath].dir ?
      fse.ensureDirSync(`${baseFolderPath}/${filePath}`) :
      fse.outputFileSync(`${baseFolderPath}/${filePath}`, zip.files[filePath].buffer)
  });
  return baseFolderPath;
};

async function uploadRoom(
  req: Request,
  res: Response,
  _driver: Driver,
  _: any
): Promise<void> {
  console.log("uploadRoom");

  upload(req, res, (err: any) => {
    if (err) {
      console.error("Failed to write " + req.file.destination + " with " + err);
    } else {
      console.log("uploaded " + req.file.originalname + " as " + req.file.filename + " Size: " + req.file.size);
    }

    const roomNo: number = req.body.roomNo;
    const destination: string = req.file?.destination;
    const filename: string = req.file.filename;

    const baseFolderPath = unzipFile(Path.join(destination, filename));
    // const yaml
    // YAML.parse(fs.readFileSync(Path.resolve(__dirname, "../config/server.yaml"), "utf8"));

    res.json({result: true});
  });
}

const resist: WebIfResister = (webApp: any, driver: Driver, db: any): void => {
  setWebIfEvent(
    webApp,
    driver,
    method,
    path,
    authenticationType,
    (driver: Driver, req: Request, res: Response) => uploadRoom(req, res, driver, db)
  );
};
export default resist;
