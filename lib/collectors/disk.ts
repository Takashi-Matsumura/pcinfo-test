import "server-only";
import type { CollectorResult, DiskEntry } from "@/lib/types";
import { runCmd } from "@/lib/exec";

const DARWIN_SKIP = [
  "devfs",
  "autofs",
  "/System/Volumes/VM",
  "/System/Volumes/Preboot",
  "/System/Volumes/Update",
  "/System/Volumes/xarts",
  "/System/Volumes/iSCPreboot",
  "/System/Volumes/Hardware",
  "/System/Volumes/Recovery",
];

function shouldKeep(device: string, mount: string): boolean {
  if (process.platform === "darwin") {
    if (device === "devfs" || device === "map auto_home" || device.startsWith("map ")) return false;
    if (DARWIN_SKIP.some((p) => mount === p || mount.startsWith(`${p}/`))) return false;
  }
  return true;
}

async function linuxDisk(mounts?: readonly string[]): Promise<DiskEntry[]> {
  const args = [
    "-P",
    "-B1",
    "-x",
    "tmpfs",
    "-x",
    "devtmpfs",
    "-x",
    "squashfs",
    "-x",
    "overlay",
  ];
  if (mounts && mounts.length > 0) args.push(...mounts);
  const r = await runCmd("df", args, { timeoutMs: 3000 });
  if (!r.ok) throw new Error(r.message);
  return r.stdout
    .trim()
    .split("\n")
    .slice(1)
    .map((line) => {
      const parts = line.trim().split(/\s+/);
      const device = parts[0] ?? "";
      const totalBytes = Number(parts[1] ?? 0);
      const usedBytes = Number(parts[2] ?? 0);
      const mount = parts.slice(5).join(" ");
      const usagePercent = totalBytes > 0 ? (usedBytes / totalBytes) * 100 : 0;
      return { device, mount, totalBytes, usedBytes, usagePercent };
    });
}

async function darwinDisk(mounts?: readonly string[]): Promise<DiskEntry[]> {
  const args = ["-k", "-l"];
  if (mounts && mounts.length > 0) args.push(...mounts);
  const r = await runCmd("df", args, { timeoutMs: 3000 });
  if (!r.ok) throw new Error(r.message);
  const lines = r.stdout.trim().split("\n").slice(1);
  const entries: DiskEntry[] = [];
  for (const line of lines) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 9) continue;
    const device = parts[0];
    if (device === "map") continue;
    const totalKb = Number(parts[1]);
    const usedKb = Number(parts[2]);
    if (!Number.isFinite(totalKb) || !Number.isFinite(usedKb)) continue;
    const mount = parts.slice(8).join(" ");
    if (!shouldKeep(device, mount)) continue;
    const totalBytes = totalKb * 1024;
    const usedBytes = usedKb * 1024;
    const usagePercent = totalBytes > 0 ? (usedBytes / totalBytes) * 100 : 0;
    entries.push({ device, mount, totalBytes, usedBytes, usagePercent });
  }
  return entries;
}

export async function collectDisk(
  mounts?: readonly string[],
): Promise<CollectorResult<DiskEntry[]>> {
  const collectedAt = new Date().toISOString();
  try {
    if (process.platform === "linux") {
      return { ok: true, value: await linuxDisk(mounts), collectedAt };
    }
    if (process.platform === "darwin") {
      return { ok: true, value: await darwinDisk(mounts), collectedAt };
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
