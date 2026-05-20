// Serialises async tasks so each `enqueue` runs only after the previous one settles.
// Figma's plugin API (loadAllPagesAsync, setReactionsAsync, …) can deadlock when
// invoked concurrently; this queue protects the message handler from that.

export class CommandQueue {
  private tail: Promise<unknown> = Promise.resolve();

  enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const result = this.tail.then(() => fn(), () => fn());
    this.tail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
}
