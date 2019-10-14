import {ApplicationError} from "./ApplicationError";

// const argon2 = require("argon2");
const bcrypt = require("bcrypt");

type HashAlgorithmType = "argon2" | "bcrypt";

const generateDefaultPromiseCallback = (resolve, reject) => (err, result) => {
  if (err) {
    reject(err);
    return;
  }
  resolve(result);
};

export async function hash(
  planeText: string,
  type: HashAlgorithmType = "argon2",
  option: any = {}
): Promise<string> {
  if (type === "bcrypt") {
    return new Promise((resolve, reject) => {
      if (!("saltRounds " in option) || typeof option.saltRounds !== "number") option.saltRounds = 10;
      bcrypt.hash(planeText, option.saltRounds, generateDefaultPromiseCallback(resolve, reject));
    });
  }
  // if (type === "argon2") return await argon2.hash(planeText);
  throw new ApplicationError(`Unsupported algorithm type. ${type}`);
}

export async function verify(
  hash: string,
  planeText: string,
  type: HashAlgorithmType = "argon2",
  ...args: any
): Promise<boolean> {
  if (type === "bcrypt") {
    return new Promise((resolve, reject) => {
      bcrypt.compare(planeText, hash, generateDefaultPromiseCallback(resolve, reject));
    });
  }
  // if (type === "argon2") return await argon2.verify(hash, planeText);
  throw new ApplicationError(`Unsupported algorithm type. ${type}`);
}