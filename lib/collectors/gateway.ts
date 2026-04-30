import "server-only";
import { runCmd } from "@/lib/exec";
import type { CollectorResult, GatewayInfo } from "@/lib/types";

async function linuxGateway(): Promise<GatewayInfo> {
  const r = await runCmd("ip", ["-j", "route", "show", "default"], {
    timeoutMs: 2000,
  });
  if (!r.ok) throw new Error(r.message);
  const arr = JSON.parse(r.stdout) as Array<{ gateway?: string; dev?: string }>;
  const def = arr.find((e) => e.gateway) ?? arr[0];
  return { gateway: def?.gateway ?? null, iface: def?.dev ?? null };
}

async function darwinGateway(): Promise<GatewayInfo> {
  const r = await runCmd("route", ["-n", "get", "default"], { timeoutMs: 2000 });
  if (!r.ok) throw new Error(r.message);
  const gw = r.stdout.match(/^\s*gateway:\s*(\S+)/m)?.[1] ?? null;
  const iface = r.stdout.match(/^\s*interface:\s*(\S+)/m)?.[1] ?? null;
  return { gateway: gw, iface };
}

export async function collectGateway(): Promise<CollectorResult<GatewayInfo>> {
  const collectedAt = new Date().toISOString();
  try {
    if (process.platform === "linux") {
      return { ok: true, value: await linuxGateway(), collectedAt };
    }
    if (process.platform === "darwin") {
      return { ok: true, value: await darwinGateway(), collectedAt };
    }
    return {
      ok: false,
      error: "Linux / macOS 以外はサポート外です",
      reason: "unsupported-platform",
      collectedAt,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
      reason: "parse",
      collectedAt,
    };
  }
}
