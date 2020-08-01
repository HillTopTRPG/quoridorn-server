/**
 * １次配列を分割し、2次配列にする。
 * ただし、最初の要素の配列は１つしか要素を持たない。
 * @param list
 * @param size
 */
function arrayChunk(list: any[], size = 1) {
  // 最初の要素は１つだけ
  return list.reduce((acc, _value, index) => index % size ? acc : [...acc, list.slice(index, index + size)], []);
}

/**
 * 並列に実行したい非同期処理を６つずつまとめて実行する
 * @param promiseList
 */
export async function procAsyncSplit(promiseList: Promise<any>[]) {
  const totalStart = process.hrtime();
  await arrayChunk(promiseList, 6)
    .map((list: Promise<void>[]) => async () => {
      const start = process.hrtime();
      await Promise.all(list);
      const end = process.hrtime(start);
      console.info('  time (hr): %dms', end[1] / 1000000);
    })
    .reduce((prev: Promise<void>, curr: () => Promise<void>) => prev.then(curr), Promise.resolve());
  const totalEnd = process.hrtime(totalStart);
  console.info('Total time (hr): %dms', totalEnd[1] / 1000000);
}
