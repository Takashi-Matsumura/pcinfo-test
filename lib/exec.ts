import "server-only";
import { execFile as execFileCb } from "node:child_process";
import { promisify } from "node:util";
import type { CollectorReason } from "./types";

const execFile = promisify(execFileCb);

export interface ExecOk {
  ok: true;
  stdout: string;
  stderr: string;
}
export interface ExecErr {
  ok: false;
  reason: CollectorReason;
  message: string;
  stdout: string;
  stderr: string;
  code: number | null;
}
export type ExecResult = ExecOk | ExecErr;

interface NodeExecError extends Error {
  code?: number | string;
  signal?: NodeJS.Signals;
  killed?: boolean;
  stdout?: string | Buffer;
  stderr?: string | Buffer;
}

export interface ExecOptions {
  timeoutMs?: number;
  maxBuffer?: number;
}

export async function runCmd(
  cmd: string,
  args: string[],
  opts: ExecOptions = {},
): Promise<ExecResult> {
  try {
    const { stdout, stderr } = await execFile(cmd, args, {
      timeout: opts.timeoutMs ?? 3000,
      maxBuffer: opts.maxBuffer ?? 1024 * 1024,
    });
    return { ok: true, stdout, stderr };
  } catch (raw) {
    const e = raw as NodeExecError;
    let reason: CollectorReason = "other";
    if (e.code === "ENOENT") reason = "not-installed";
    else if (e.killed && e.signal === "SIGTERM") reason = "timeout";
    else if (e.code === "EACCES" || /permission/i.test(e.message ?? "")) reason = "permission";

    const stdout =
      typeof e.stdout === "string" ? e.stdout : e.stdout?.toString("utf8") ?? "";
    const stderr =
      typeof e.stderr === "string" ? e.stderr : e.stderr?.toString("utf8") ?? "";
    return {
      ok: false,
      reason,
      message: e.message ?? String(raw),
      stdout,
      stderr,
      code: typeof e.code === "number" ? e.code : null,
    };
  }
}
