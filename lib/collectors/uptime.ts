import "server-only";
import os from "node:os";
import type { CollectorResult } from "@/lib/types";

export async function collectUptime(): Promise<
  CollectorResult<{ uptimeSeconds: number; bootEpoch: number }>
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
  const uptimeSeconds = os.uptime();
  const bootEpoch = Math.floor(Date.now() / 1000 - uptimeSeconds);
  return { ok: true, value: { uptimeSeconds, bootEpoch }, collectedAt };
}
