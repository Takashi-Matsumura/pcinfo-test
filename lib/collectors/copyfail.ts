import "server-only";
import os from "node:os";
import { runCmd } from "@/lib/exec";
import type { CollectorResult, CopyFailStatus } from "@/lib/types";

async function isAlgifAeadLoaded(): Promise<boolean> {
  const r = await runCmd("cat", ["/proc/modules"], { timeoutMs: 1000 });
  if (!r.ok) return false;
  return r.stdout.split("\n").some((line) => line.startsWith("algif_aead "));
}

async function isAlgifAeadBlacklisted(): Promise<boolean> {
  const r = await runCmd(
    "grep",
    [
      "-rhE",
      "^[[:space:]]*blacklist[[:space:]]+algif_aead\\b",
      "/etc/modprobe.d",
      "/usr/lib/modprobe.d",
      "/run/modprobe.d",
    ],
    { timeoutMs: 1500 },
  );
  if (!r.ok) return false;
  return r.stdout.trim().length > 0;
}

async function readDistro(): Promise<{ id: string | null; pretty: string | null }> {
  const r = await runCmd("cat", ["/etc/os-release"], { timeoutMs: 1000 });
  if (!r.ok) return { id: null, pretty: null };
  const map: Record<string, string> = {};
  for (const line of r.stdout.split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) map[m[1]] = m[2].replace(/^"|"$/g, "");
  }
  return { id: map.ID ?? null, pretty: map.PRETTY_NAME ?? null };
}

async function readProcVersion(): Promise<string | null> {
  const r = await runCmd("cat", ["/proc/version"], { timeoutMs: 1000 });
  if (!r.ok) return null;
  return r.stdout.trim();
}

export async function collectCopyFail(): Promise<CollectorResult<CopyFailStatus>> {
  const collectedAt = new Date().toISOString();

  if (process.platform !== "linux") {
    return {
      ok: true,
      value: {
        kernel: os.release(),
        procVersion: null,
        distro: { id: null, pretty: null },
        algifAeadLoaded: false,
        blacklisted: false,
        mitigation: "non-linux",
        note: "Linux 専用の脆弱性です。当ホストは対象外。",
      },
      collectedAt,
    };
  }

  const [loaded, blacklisted, distro, procVersion] = await Promise.all([
    isAlgifAeadLoaded(),
    isAlgifAeadBlacklisted(),
    readDistro(),
    readProcVersion(),
  ]);

  let mitigation: CopyFailStatus["mitigation"];
  let note: string;
  if (loaded) {
    mitigation = "loaded-vulnerable";
    note =
      "algif_aead モジュールがロード中。CVE-2026-31431 の脆弱コードがアクティブです。カーネル更新、または当モジュールのブラックリスト化を推奨。";
  } else if (blacklisted) {
    mitigation = "blacklisted";
    note = "algif_aead は modprobe ブラックリストで無効化されており、緩和済み。";
  } else {
    mitigation = "not-loaded";
    note =
      "algif_aead は未ロードですが、ブラックリスト未設定のため AF_ALG 経由で自動ロードされる可能性があります。カーネル更新の適用状況を確認してください。";
  }

  return {
    ok: true,
    value: {
      kernel: os.release(),
      procVersion,
      distro,
      algifAeadLoaded: loaded,
      blacklisted,
      mitigation,
      note,
    },
    collectedAt,
  };
}
