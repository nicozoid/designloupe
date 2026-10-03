import { describe, expect, it } from "vitest";
import { runLimited } from "./limit";

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("runLimited", () => {
  it("never runs more than `limit` tasks concurrently", async () => {
    let active = 0;
    let maxActive = 0;
    const defs = Array.from({ length: 10 }, () => deferred<number>());
    const tasks = defs.map((d, i) => () => {
      active++;
      maxActive = Math.max(maxActive, active);
      return d.promise.finally(() => active--).then(() => i);
    });

    const result = runLimited(tasks, 3);
    // Let the first batch start.
    await Promise.resolve();
    expect(active).toBe(3);

    // Resolve them one by one, checking concurrency never climbs above 3.
    for (const d of defs) {
      d.resolve(0);
      await Promise.resolve();
      await Promise.resolve();
      expect(active).toBeLessThanOrEqual(3);
    }

    await result;
    expect(maxActive).toBe(3);
  });

  it("settles all tasks, including rejections, without the returned promise rejecting", async () => {
    const tasks = [
      () => Promise.resolve("a"),
      () => Promise.reject(new Error("boom")),
      () => Promise.resolve("c"),
    ];
    const results = await runLimited(tasks, 2);
    expect(results).toHaveLength(3);
    expect(results[0]).toEqual({ status: "fulfilled", value: "a" });
    expect(results[1]!.status).toBe("rejected");
    expect((results[1] as PromiseRejectedResult).reason.message).toBe("boom");
    expect(results[2]).toEqual({ status: "fulfilled", value: "c" });
  });

  it("preserves input order even when later tasks settle first", async () => {
    const fast = () => Promise.resolve("fast");
    const slow = () => new Promise<string>((resolve) => setTimeout(() => resolve("slow"), 10));
    const results = await runLimited([slow, fast, slow, fast], 4);
    expect(results.map((r) => (r as PromiseFulfilledResult<string>).value)).toEqual(["slow", "fast", "slow", "fast"]);
  });

  it("handles an empty task list", async () => {
    expect(await runLimited([], 5)).toEqual([]);
  });

  it("handles a limit larger than the task count", async () => {
    const results = await runLimited([() => Promise.resolve(1), () => Promise.resolve(2)], 10);
    expect(results.map((r) => (r as PromiseFulfilledResult<number>).value)).toEqual([1, 2]);
  });
});
