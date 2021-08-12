import {Response} from "express";
import {Archiver} from "archiver";
import * as fs from "fs";
const archiver = require('archiver');

export async function executeArchiveDownload(res: Response, filePath: string, callback: (archive: Archiver) => Promise<void>) {
  const archive = archiver.create('zip', {
    zlib: { level: 9 }
  });
  const output = await fs.createWriteStream(filePath);
  archive.pipe(output);

  await callback(archive);

  await archive.finalize();
  setTimeout(async() => {
    await res.download(filePath);
    setTimeout(() => fs.unlinkSync(filePath), 100);
  }, 100);
}
