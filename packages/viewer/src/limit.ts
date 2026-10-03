/**
 * Run `tasks` with at most `limit` in flight at once. Never rejects: each
 * task's outcome is reported as a PromiseSettledResult, in input order.
 */
export function runLimited<T>(tasks: (() => Promise<T>)[], limit: number): Promise<PromiseSettledResult<T>[]> {
  return new Promise((resolve) => {
    const results: PromiseSettledResult<T>[] = new Array(tasks.length);
    if (tasks.length === 0) {
      resolve(results);
      return;
    }
    let next = 0;
    let done = 0;
    const size = Math.max(1, Math.min(limit, tasks.length));

    const runOne = () => {
      const i = next++;
      if (i >= tasks.length) return;
      tasks[i]!()
        .then((value) => {
          results[i] = { status: "fulfilled", value };
        })
        .catch((reason) => {
          results[i] = { status: "rejected", reason };
        })
        .finally(() => {
          done++;
          if (done === tasks.length) resolve(results);
          else runOne();
        });
    };

    for (let i = 0; i < size; i++) runOne();
  });
}
