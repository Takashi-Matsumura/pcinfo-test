import "server-only";
import { readFile } from "node:fs/promises";
import { runCmd } from "@/lib/exec";
import type { CollectorResult } from "@/lib/types";

interface MemValue {
  totalBytes: number;
  availableBytes: number;
  usedBytes: number;
  usagePercent: number;
}

async function linuxMem(): Promise<MemValue> {
  const text = await readFile("/proc/meminfo", "utf8");
  const get = (k: string): number | null => {
    const m = text.match(new RegExp(`^${k}:\\s+(\\d+)\\s+kB`, "m"));
    return m ? Number(m[1]) * 1024 : null;
  };
  const total = get("MemTotal");
  const available = get("MemAvailable");
  if (total === null || available === null) {
    throw new Error("MemTotal / MemAvailable のパースに失敗");
  }
  const used = total - available;
  return {
    totalBytes: total,
    availableBytes: available,
    usedBytes: used,
    usagePercent: total > 0 ? (used / total) * 100 : 0,
  };
}

function parseVmStat(text: string): { pageSize: number; pages: Record<string, number> } {
  const pageMatch = text.match(/page size of (\d+) bytes/);
  const pageSize = pageMatch ? Number(pageMatch[1]) : 4096;
  const pages: Record<string, number> = {};
  for (const line of text.split("\n")) {
    const m = line.match(/^([^:]+):\s+(\d+)\.?\s*$/);
    if (m) pages[m[1].trim()] = Number(m[2]);
  }
  return { pageSize, pages };
}

async function darwinMem(): Promise<MemValue> {
  const [vmRes, sysctlRes] = await Promise.all([
    runCmd("vm_stat", [], { timeoutMs: 2000 }),
    runCmd("sysctl", ["-n", "hw.memsize"], { timeoutMs: 1000 }),
  ]);
  if (!vmRes.ok) throw new Error(`vm_stat: ${vmRes.message}`);
  if (!sysctlRes.ok) throw new Error(`sysctl: ${sysctlRes.message}`);
  const total = Number(sysctlRes.stdout.trim());
  const { pageSize, pages } = parseVmStat(vmRes.stdout);
  const active = (pages["Pages active"] ?? 0) * pageSize;
  const wired = (pages["Pages wired down"] ?? 0) * pageSize;
  const compressed = (pages["Pages occupied by compressor"] ?? 0) * pageSize;
  const used = active + wired + compressed;
  const available = Math.max(0, total - used);
  return {
    totalBytes: total,
    availableBytes: available,
    usedBytes: used,
    usagePercent: total > 0 ? (used / total) * 100 : 0,
  };
}

export async function collectMem(): Promise<CollectorResult<MemValue>> {
  const collectedAt = new Date().toISOString();
  try {
    if (process.platform === "linux") {
      return { ok: true, value: await linuxMem(), collectedAt };
    }
    if (process.platform === "darwin") {
      return { ok: true, value: await darwinMem(), collectedAt };
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
