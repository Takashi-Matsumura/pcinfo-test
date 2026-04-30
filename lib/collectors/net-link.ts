import "server-only";
import { readdir, readFile } from "node:fs/promises";
import { runCmd } from "@/lib/exec";
import type { CollectorResult, NetLinkEntry } from "@/lib/types";

async function tryRead(path: string): Promise<string | null> {
  try {
    return (await readFile(path, "utf8")).trim();
  } catch {
    return null;
  }
}

async function linuxNetLink(filter?: readonly string[]): Promise<NetLinkEntry[]> {
  const all = await readdir("/sys/class/net");
  const wanted =
    filter && filter.length > 0
      ? all.filter((n) => filter.includes(n))
      : all.filter((n) => n !== "lo");
  const entries: NetLinkEntry[] = [];
  for (const name of wanted) {
    const operstateRaw = await tryRead(`/sys/class/net/${name}/operstate`);
    const operstate: NetLinkEntry["operstate"] =
      operstateRaw === "up" ? "up" : operstateRaw === "down" ? "down" : "unknown";
    const carrierRaw = await tryRead(`/sys/class/net/${name}/carrier`);
    const carrier: 0 | 1 = carrierRaw === "1" ? 1 : 0;
    const speedRaw = await tryRead(`/sys/class/net/${name}/speed`);
    const speedMbps =
      speedRaw && Number.isFinite(Number(speedRaw)) && Number(speedRaw) > 0
        ? Number(speedRaw)
        : null;
    entries.push({ name, operstate, carrier, speedMbps });
  }
  return entries;
}

function parseDarwinIfconfig(text: string): NetLinkEntry[] {
  const blocks = text.split(/^(?=\S)/m);
  const entries: NetLinkEntry[] = [];
  for (const block of blocks) {
    const head = block.match(/^([a-zA-Z0-9._]+):\s*flags=/);
    if (!head) continue;
    const name = head[1];
    if (name === "lo0") continue;
    const statusMatch = block.match(/status:\s*(\w+)/);
    const operstate: NetLinkEntry["operstate"] =
      statusMatch?.[1] === "active" ? "up" : statusMatch?.[1] === "inactive" ? "down" : "unknown";
    const carrier: 0 | 1 = operstate === "up" ? 1 : 0;
    const mediaMatch = block.match(/media:[^\n]*?\((\d+)base/);
    const speedMbps = mediaMatch ? Number(mediaMatch[1]) : null;
    if (!statusMatch) continue;
    entries.push({ name, operstate, carrier, speedMbps });
  }
  return entries;
}

async function darwinNetLink(filter?: readonly string[]): Promise<NetLinkEntry[]> {
  const r = await runCmd("ifconfig", ["-a"], { timeoutMs: 2000 });
  if (!r.ok) throw new Error(r.message);
  const all = parseDarwinIfconfig(r.stdout);
  return filter && filter.length > 0 ? all.filter((e) => filter.includes(e.name)) : all;
}

export async function collectNetLink(
  filter?: readonly string[],
): Promise<CollectorResult<NetLinkEntry[]>> {
  const collectedAt = new Date().toISOString();
  try {
    if (process.platform === "linux") {
      return { ok: true, value: await linuxNetLink(filter), collectedAt };
    }
    if (process.platform === "darwin") {
      return { ok: true, value: await darwinNetLink(filter), collectedAt };
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
      reason: "other",
      collectedAt,
    };
  }
}
