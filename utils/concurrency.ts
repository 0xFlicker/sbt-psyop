export function promiseAllWithConcurrency<T>(
  list: Array<() => Promise<T>>,
  n: number
): Promise<T[]> {
  if (list.length <= n) {
    return Promise.all(list.map((x) => x()));
  }
  let tail = list.splice(n);
  let head = list;
  let resolved: Promise<T>[] = [];
  let processed = 0;

  return new Promise<T[]>((resolve) => {
    head.forEach((x) => {
      let res = x();
      resolved.push(res);
      res.then((y) => {
        runNext();
        return y;
      });
    });

    function runNext() {
      if (processed == tail.length) {
        resolve(Promise.all(resolved));
      } else {
        resolved.push(
          tail[processed]().then((x) => {
            runNext();
            return x;
          })
        );
        processed++;
      }
    }
  });
}

export async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function retryWithBackOff<T>(
  fn: () => Promise<T>,
  maxRetries: number,
  backOff: number
) {
  let retries = 0;
  while (true) {
    try {
      return await fn();
    } catch (e) {
      if (retries >= maxRetries) {
        throw e;
      }
      retries++;
      await sleep(backOff);
    }
  }
}
