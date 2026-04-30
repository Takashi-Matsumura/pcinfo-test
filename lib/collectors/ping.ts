import "server-only";
import { runCmd } from "@/lib/exec";
import type { CollectorResult, PingResult } from "@/lib/types";

export interface PingTarget {
  name: string;
  host: string;
}

function pingArgs(host: string): string[] {
  if (process.platform === "darwin") {
    return ["-c", "1", "-t", "2", host];
  }
  return ["-c", "1", "-W", "2", host];
}

export async function collectPing(
  targets: readonly PingTarget[],
  gateway: string | null,
): Promise<CollectorResult<PingResult[]>> {
  const collectedAt = new Date().toISOString();
  if (process.platform !== "linux" && process.platform !== "darwin") {
    return {
      ok: false,
      error: "Linux / macOS 以外はサポート外です",
      reason: "unsupported-platform",
      collectedAt,
    };
  }
  const results = await Promise.all(
    targets.map(async (t): Promise<PingResult> => {
      const host = t.host === "__gateway__" ? gateway : t.host;
      if (!host) return { name: t.name, host: null, ok: false, rttMs: null };
      const r = await runCmd("ping", pingArgs(host), { timeoutMs: 3500 });
      if (!r.ok) return { name: t.name, host, ok: false, rttMs: null };
      const m = r.stdout.match(/time[=<]([\d.]+)\s*ms/);
      return { name: t.name, host, ok: true, rttMs: m ? Number(m[1]) : null };
    }),
  );
  return { ok: true, value: results, collectedAt };
}
