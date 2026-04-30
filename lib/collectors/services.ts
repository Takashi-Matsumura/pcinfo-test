import "server-only";
import { runCmd } from "@/lib/exec";
import type { CollectorResult, ServiceState } from "@/lib/types";

async function linuxOne(unit: string): Promise<ServiceState> {
  const r = await runCmd("systemctl", ["is-active", unit], { timeoutMs: 2000 });
  const active = r.ok ? r.stdout.trim() : r.stdout.trim() || "unknown";
  return { unit, active };
}

async function darwinOne(label: string): Promise<ServiceState> {
  const r = await runCmd("launchctl", ["list", label], { timeoutMs: 2000 });
  if (!r.ok) {
    if (r.reason === "not-installed") return { unit: label, active: "launchctl 不在" };
    if (r.code !== null) return { unit: label, active: "not-loaded" };
    return { unit: label, active: "unknown" };
  }
  const pidMatch = r.stdout.match(/"PID"\s*=\s*(\d+)/);
  const exitMatch = r.stdout.match(/"LastExitStatus"\s*=\s*(\d+)/);
  const exit = exitMatch ? Number(exitMatch[1]) : 0;
  if (pidMatch) return { unit: label, active: "active" };
  if (exit !== 0) return { unit: label, active: "failed" };
  return { unit: label, active: "loaded" };
}

export async function collectServices(
  units: readonly string[],
): Promise<CollectorResult<ServiceState[]>> {
  const collectedAt = new Date().toISOString();
  if (process.platform !== "linux" && process.platform !== "darwin") {
    return {
      ok: false,
      error: "Linux / macOS 以外はサポート外です",
      reason: "unsupported-platform",
      collectedAt,
    };
  }
  if (units.length === 0) return { ok: true, value: [], collectedAt };
  const fn = process.platform === "linux" ? linuxOne : darwinOne;
  const results = await Promise.all(units.map((u) => fn(u)));
  return { ok: true, value: results, collectedAt };
}
