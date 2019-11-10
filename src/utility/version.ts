import {ApplicationError} from "../error/ApplicationError";

export type VersionInfo = {
  major: number;
  minor: number;
  build: number;
  stage?: string;
  stageVersion?: number;
};

/** ============================================================
 * バージョン同士を比較する
 * @param v1 バージョン
 * @param v2 バージョン
 */
export function compareVersion(v1: VersionInfo, v2: VersionInfo): number {
  if (v1.major < v2.major) return -1;
  if (v1.major > v2.major) return 1;
  if (v1.minor < v2.minor) return -1;
  if (v1.minor > v2.minor) return 1;
  if (v1.build < v2.build) return -1;
  if (v1.build > v2.build) return 1;
  if (v1.stage && v1.stageVersion && v2.stage && v2.stageVersion) {
    const stageOrder = ["a", "b", "rc", "s"];
    const v1StageIndex = stageOrder.findIndex(stage => stage === v1.stage);
    const v2StageIndex = stageOrder.findIndex(stage => stage === v2.stage);
    if (v1StageIndex < v2StageIndex) return -1;
    if (v1StageIndex > v2StageIndex) return 1;
    if (v1.stageVersion < v2.stageVersion) return -1;
    if (v1.stageVersion > v2.stageVersion) return 1;
  }
  if (v1.stage && v1.stageVersion && (!v2.stage || !v2.stageVersion)) {
    return -1;
  }
  if ((!v1.stage || !v1.stageVersion) && v2.stage && v2.stageVersion) {
    return 1;
  }
  return 0;
}

/** ============================================================
 * バージョンを文字列にする
 * @param v バージョン
 */
function versionToString(v: VersionInfo | null): string {
  if (!v) return "none";
  let version: string = `${v.major}.${v.minor}.${v.build}`;
  if (v.stage && v.stageVersion) version += `${v.stage}${v.stageVersion}`;
  return version;
}

/** ============================================================
 * バージョン文字列をパースする
 * @param version 文字列
 */
export function stringToVersion(version: string | null): VersionInfo {
  if (!version)
    throw new ApplicationError(`Illegal argument. version=${version}`);
  const matchResult = version.match(
    /^([0-9]+)\.([0-9]+)\.([0-9]+)(?:(a|b|s|rc)([0-9]+))?/
  );
  if (!matchResult)
    throw new ApplicationError(`Illegal format. str=${version}`);
  const major: number = parseInt(matchResult[1], 10);
  const minor: number = parseInt(matchResult[2], 10);
  const build: number = parseInt(matchResult[3], 10);
  const stage: string = matchResult[4];
  const stageVersion: number = parseInt(matchResult[5], 10);
  return {
    major,
    minor,
    build,
    stage,
    stageVersion
  };
}