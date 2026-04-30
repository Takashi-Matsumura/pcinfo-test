import "server-only";
import { setTimeout as sleep } from "node:timers/promises";
import os from "node:os";
import type { CollectorResult } from "@/lib/types";

interface Snapshot {
  total: number;
  idle: number;
}

function snapshot(): Snapshot {
  let total = 0;
  let idle = 0;
  for (const c of os.cpus()) {
    const t = c.times;
    total += t.user + t.nice + t.sys + t.idle + t.irq;
    idle += t.idle;
  }
  return { total, idle };
}

export async function collectCpu(): Promise<
  CollectorResult<{ usagePercent: number; cores: number }>
> {
  const collectedAt = new Date().toISOString();
  if (process.platform !== "linux" && process.platform !== "darwin") {
    return {
      ok: false,
      error: "Linux / macOS 以外はサポート外です",
      reason: "unsupported-platform",
      collectedAt,
    };
  }
  try {
    const a = snapshot();
    await sleep(200);
    const b = snapshot();
    const totalDiff = b.total - a.total;
    const idleDiff = b.idle - a.idle;
    const usagePercent =
      totalDiff > 0
        ? Math.max(0, Math.min(100, (1 - idleDiff / totalDiff) * 100))
        : 0;
    return {
      ok: true,
      value: { usagePercent, cores: os.cpus().length },
      collectedAt,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
      reason: "other",
      collectedAt,
    };
  }
}
