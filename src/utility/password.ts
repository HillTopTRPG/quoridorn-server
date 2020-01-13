import {ApplicationError} from "../error/ApplicationError";
// const argon2 = require("argon2");
const bcrypt = require("bcrypt");

export type HashAlgorithmType = "argon2" | "bcrypt";

/* TODO
 * 現在、Argon2 がビルドできないためサポート外の暗号化アルゴリズムとなっている。
 * この問題がクリアできれば、Argon2 アルゴリズムを使いたい。
 */

/**
 * パスワードをハッシュ化する
 * @param planeText
 * @param type
 * @param option
 */
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
  throw new ApplicationError(`Unsupported algorithm.`, { type });
}

/**
 * パスワードを照合する
 * @param hash
 * @param planeText
 * @param type
 */
export async function verify(
  hash: string,
  planeText: string,
  type: HashAlgorithmType = "argon2"
): Promise<boolean> {
  if (type === "bcrypt") {
    return new Promise((resolve, reject) => {
      bcrypt.compare(planeText, hash, generateDefaultPromiseCallback(resolve, reject));
    });
  }
  // if (type === "argon2") return await argon2.verify(hash, planeText);
  throw new ApplicationError(`Unsupported algorithm type. ${type}`);
}

const generateDefaultPromiseCallback =
  (resolve: (result: any) =>
    void, reject: (err: any) => void) =>
      (err: any, result: any) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(result);
      };
