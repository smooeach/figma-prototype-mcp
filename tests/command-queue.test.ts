import { describe, it, expect } from "vitest";
import { CommandQueue } from "../src/figma-plugin/command-queue.js";

describe("CommandQueue", () => {
  it("runs concurrently-enqueued tasks one at a time in submission order", async () => {
    const queue = new CommandQueue();
    const order: string[] = [];
    const task = (label: string, ms: number) => async () => {
      order.push(`${label}-start`);
      await new Promise((r) => setTimeout(r, ms));
      order.push(`${label}-end`);
      return label;
    };

    const results = await Promise.all([
      queue.enqueue(task("a", 30)),
      queue.enqueue(task("b", 5)),
      queue.enqueue(task("c", 15)),
    ]);

    expect(order).toEqual([
      "a-start", "a-end",
      "b-start", "b-end",
      "c-start", "c-end",
    ]);
    expect(results).toEqual(["a", "b", "c"]);
  });

  it("propagates a task's rejection to its own caller without blocking the queue", async () => {
    const queue = new CommandQueue();

    const failPromise = queue.enqueue(async () => {
      throw new Error("boom");
    });
    const nextPromise = queue.enqueue(async () => "after-failure");

    await expect(failPromise).rejects.toThrow("boom");
    await expect(nextPromise).resolves.toBe("after-failure");
  });

  it("preserves submission order even when an earlier task fails", async () => {
    const queue = new CommandQueue();
    const order: string[] = [];

    const p1 = queue.enqueue(async () => {
      order.push("1");
      await new Promise((r) => setTimeout(r, 10));
      throw new Error("first");
    });
    const p2 = queue.enqueue(async () => {
      order.push("2");
      return "two";
    });

    await expect(p1).rejects.toThrow("first");
    await expect(p2).resolves.toBe("two");
    expect(order).toEqual(["1", "2"]);
  });
});
