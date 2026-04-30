import "server-only";
import { runCmd } from "@/lib/exec";
import type { CollectorResult, LogEntry } from "@/lib/types";
import { monitorConfig } from "@/config/monitor";

async function linuxLogs(): Promise<LogEntry[]> {
  const out: LogEntry[] = [];
  const j = await runCmd(
    "journalctl",
    [
      "-p",
      "err",
      "-n",
      String(monitorConfig.log.journalctlLines),
      "--no-pager",
      "-o",
      "short-iso",
    ],
    { timeoutMs: 4000 },
  );
  if (j.ok) {
    j.stdout
      .trim()
      .split("\n")
      .filter(Boolean)
      .slice(-monitorConfig.log.journalctlLines)
      .forEach((line) => out.push({ source: "journal", line }));
  }
  const d = await runCmd("dmesg", ["-T", "--level=err,warn"], { timeoutMs: 3000 });
  if (d.ok) {
    d.stdout
      .trim()
      .split("\n")
      .filter(Boolean)
      .slice(-monitorConfig.log.dmesgLines)
      .forEach((line) => out.push({ source: "kernel", line }));
  }
  return out;
}

async function darwinLogs(): Promise<LogEntry[]> {
  const out: LogEntry[] = [];
  const limit = monitorConfig.log.journalctlLines;
  const r = await runCmd(
    "log",
    [
      "show",
      "--last",
      "1h",
      "--style",
      "syslog",
      "--predicate",
      'messageType == "error" OR messageType == "fault"',
    ],
    { timeoutMs: 8000, maxBuffer: 4 * 1024 * 1024 },
  );
  if (r.ok) {
    r.stdout
      .trim()
      .split("\n")
      .filter((l) => l && !/^Filtering the log data/i.test(l) && !/^Timestamp\s/.test(l))
      .slice(-limit)
      .forEach((line) => out.push({ source: "journal", line }));
  }
  return out;
}

export async function collectLogs(): Promise<CollectorResult<LogEntry[]>> {
  const collectedAt = new Date().toISOString();
  try {
    if (process.platform === "linux") {
      return { ok: true, value: await linuxLogs(), collectedAt };
    }
    if (process.platform === "darwin") {
      return { ok: true, value: await darwinLogs(), collectedAt };
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
