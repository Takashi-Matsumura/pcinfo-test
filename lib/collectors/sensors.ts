import "server-only";
import { runCmd } from "@/lib/exec";
import type {
  CollectorResult,
  SensorsValue,
  TempReading,
  ThermalPressure,
} from "@/lib/types";

function walk(
  node: unknown,
  parentLabel: string,
  sensorName: string,
  out: TempReading[],
): void {
  if (typeof node !== "object" || node === null) return;
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    if (typeof value === "number" && /^temp\d+_input$/.test(key)) {
      out.push({ sensor: sensorName, label: parentLabel || key, tempC: value });
    } else if (typeof value === "object" && value !== null) {
      walk(value, key, sensorName, out);
    }
  }
}

async function linuxSensors(): Promise<SensorsValue> {
  const r = await runCmd("sensors", ["-j"], { timeoutMs: 3000 });
  if (!r.ok) throw new Error(r.message);
  const json = JSON.parse(r.stdout) as Record<string, unknown>;
  const readings: TempReading[] = [];
  for (const [chip, body] of Object.entries(json)) {
    walk(body, "", chip, readings);
  }
  const maxTempC = readings.length > 0 ? Math.max(...readings.map((x) => x.tempC)) : null;
  return { maxTempC, readings };
}

function parsePmsetTherm(text: string): ThermalPressure {
  const speedMatch = text.match(/CPU_Speed_Limit\s*=\s*(\d+)/);
  const schedulerMatch = text.match(/CPU_Scheduler_Limit\s*=\s*(\d+)/);
  const cpusMatch = text.match(/CPU_Available_CPUs\s*=\s*(\d+)/);
  const cpuSpeedLimit = speedMatch ? Number(speedMatch[1]) : 100;
  const schedulerLimit = schedulerMatch ? Number(schedulerMatch[1]) : null;
  const availableCpus = cpusMatch ? Number(cpusMatch[1]) : null;

  const noThermal = /No thermal warning level has been recorded/i.test(text);
  const thermalWarn = text.match(/thermal warning level is\s*(\S+)/i);
  let note = "";
  if (cpuSpeedLimit < 100) {
    note = `CPU 速度制限が ${cpuSpeedLimit}% に低下中（熱抑制の可能性）`;
  } else if (thermalWarn) {
    note = `熱警告レベル: ${thermalWarn[1]}`;
  } else if (noThermal) {
    note = "現在、熱警告は記録されていません";
  } else {
    note = "情報なし";
  }
  return { cpuSpeedLimit, schedulerLimit, availableCpus, note };
}

async function darwinSensors(): Promise<SensorsValue> {
  const r = await runCmd("pmset", ["-g", "therm"], { timeoutMs: 2000 });
  if (!r.ok) throw new Error(r.message);
  const thermalPressure = parsePmsetTherm(r.stdout);
  return { maxTempC: null, readings: [], thermalPressure };
}

export async function collectSensors(): Promise<CollectorResult<SensorsValue>> {
  const collectedAt = new Date().toISOString();
  try {
    if (process.platform === "linux") {
      return { ok: true, value: await linuxSensors(), collectedAt };
    }
    if (process.platform === "darwin") {
      return { ok: true, value: await darwinSensors(), collectedAt };
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
