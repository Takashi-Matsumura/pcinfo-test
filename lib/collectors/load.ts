import "server-only";
import os from "node:os";
import type { CollectorResult } from "@/lib/types";

export async function collectLoad(): Promise<
  CollectorResult<{ "1m": number; "5m": number; "15m": number; cores: number }>
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
  const [a, b, c] = os.loadavg();
  return {
    ok: true,
    value: { "1m": a, "5m": b, "15m": c, cores: os.cpus().length },
    collectedAt,
  };
}
