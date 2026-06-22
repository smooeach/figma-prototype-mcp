import { randomUUID } from "node:crypto";

export type ProtoToolName =
  | "proto_wire"
  | "proto_change_to"
  | "proto_overlay"
  | "proto_scroll"
  | "proto_back"
  | "proto_url"
  | "proto_set_variable"
  | "proto_set_variable_mode"
  | "proto_toggle_variable"
  | "proto_conditional"
  | "proto_media";

export interface HistoryEntry {
  historyId: string;
  timestamp: number;
  tool: ProtoToolName;
  input: unknown;
  result: {
    successCount: number;
    errorCount: number;
    warningCount: number;
  };
}

export class HistoryStore {
  private buffer: HistoryEntry[] = [];
  private readonly capacity: number;

  constructor(capacity = 10) {
    this.capacity = capacity;
  }

  record(
    tool: ProtoToolName,
    input: unknown,
    result: HistoryEntry["result"],
  ): HistoryEntry | null {
    if (result.successCount === 0) return null;
    const entry: HistoryEntry = {
      historyId: randomUUID(),
      timestamp: Date.now(),
      tool,
      input,
      result,
    };
    this.buffer.push(entry);
    if (this.buffer.length > this.capacity) this.buffer.shift();
    return entry;
  }

  /**
   * Return up to `count` most-recent entries in oldest-to-newest order
   * (so `arr.at(-1)` is the most recent). Empty array if count < 1.
   * Clamped to `buffer.length` when count exceeds it.
   */
  getLast(count = 1): HistoryEntry[] {
    if (count < 1) return [];
    return this.buffer.slice(-Math.min(count, this.buffer.length));
  }

  size(): number {
    return this.buffer.length;
  }
}

export function summarizeResult(raw: unknown): HistoryEntry["result"] {
  if (typeof raw !== "object" || raw === null) {
    return { successCount: 0, errorCount: 0, warningCount: 0 };
  }
  const r = raw as { successCount?: number; errorCount?: number; warningCount?: number };
  return {
    successCount: typeof r.successCount === "number" ? r.successCount : 0,
    errorCount: typeof r.errorCount === "number" ? r.errorCount : 0,
    warningCount: typeof r.warningCount === "number" ? r.warningCount : 0,
  };
}
