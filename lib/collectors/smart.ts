import "server-only";
import { runCmd } from "@/lib/exec";
import type { CollectorResult, SmartReading } from "@/lib/types";

interface SmartJson {
  smart_status?: { passed?: boolean };
  temperature?: { current?: number };
}

async function smartOne(device: string): Promise<SmartReading> {
  const r = await runCmd("smartctl", ["--json", "-H", "-A", device], {
    timeoutMs: 5000,
  });
  if (!r.ok) {
    const status =
      r.reason === "not-installed"
        ? "smartctl 未インストール"
        : r.reason === "permission"
          ? "権限不足（root か CAP_SYS_RAWIO 必要）"
          : "取得失敗";
    return { device, passed: false, status, tempC: null };
  }
  try {
    const j = JSON.parse(r.stdout) as SmartJson;
    const passed = j.smart_status?.passed === true;
    const tempC =
      typeof j.temperature?.current === "number" ? j.temperature.current : null;
    return {
      device,
      passed,
      status: passed ? "PASSED" : j.smart_status ? "FAILED" : "不明",
      tempC,
    };
  } catch {
    return { device, passed: false, status: "パース失敗", tempC: null };
  }
}

export async function collectSmart(
  devices: readonly string[],
): Promise<CollectorResult<SmartReading[]>> {
  const collectedAt = new Date().toISOString();
  if (process.platform !== "linux" && process.platform !== "darwin") {
    return {
      ok: false,
      error: "Linux / macOS 以外はサポート外です",
      reason: "unsupported-platform",
      collectedAt,
    };
  }
  if (devices.length === 0) {
    return { ok: true, value: [], collectedAt };
  }
  const readings = await Promise.all(devices.map((d) => smartOne(d)));
  return { ok: true, value: readings, collectedAt };
}
