import fs from "fs";
import * as path from "path";
import {Property} from "../@types/property";

export function readProperty(filePath: string): Property {
  const propertyInfo: {[key: string]: string} = {};
  fs.readFileSync(filePath, "utf8")
  .split("\n")
  .forEach(line => {
    const matchResult = line.match(/([a-zA-Z_]+) *= *"([0-9a-zA-Z.]+)"/);
    if (!matchResult) return;
    propertyInfo[matchResult[1]] = matchResult[2];
  });
  return propertyInfo;
}
