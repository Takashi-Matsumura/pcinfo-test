import { monitorConfig } from "@/config/monitor";
import type {
  BasicResources,
  CollectorResult,
  HardwareNetwork,
  ServiceState,
  Severity,
} from "./types";

export type Category = "hardware" | "software" | "network";

export interface CategoryFinding {
  category: Category;
  severity: Severity;
  hits: string[];
}

export interface SummaryResult {
  overall: Severity;
  primary: Category | null;
  findings: CategoryFinding[];
  message: string;
}

const SEV_RANK: Record<Severity, number> = {
  ok: 0,
  unknown: 0,
  warn: 1,
  critical: 2,
};

function worse(a: Severity, b: Severity): Severity {
  return SEV_RANK[a] >= SEV_RANK[b] ? a : b;
}

const CATEGORY_LABEL: Record<Category, string> = {
  hardware: "ハードウェア",
  software: "ソフトウェア／サービス",
  network: "ネットワーク",
};

export interface SummarizeInput {
  basic: BasicResources;
  health?: HardwareNetwork;
  services?: CollectorResult<ServiceState[]>;
}

export function summarize({ basic, health, services }: SummarizeInput): SummaryResult {
  const t = monitorConfig.thresholds;
  const buckets: Record<Category, CategoryFinding> = {
    hardware: { category: "hardware", severity: "ok", hits: [] },
    software: { category: "software", severity: "ok", hits: [] },
    network: { category: "network", severity: "ok", hits: [] },
  };

  const note = (cat: Category, sev: Severity, msg: string) => {
    const f = buckets[cat];
    f.severity = worse(f.severity, sev);
    if (sev === "warn" || sev === "critical") f.hits.push(msg);
  };

  // ----- basic -----
  if (basic.cpu.ok) {
    const p = basic.cpu.value.usagePercent;
    if (p >= t.cpuPercent.critical) note("software", "critical", `CPU ${p.toFixed(0)}%`);
    else if (p >= t.cpuPercent.warn) note("software", "warn", `CPU ${p.toFixed(0)}%`);
  }
  if (basic.mem.ok) {
    const p = basic.mem.value.usagePercent;
    if (p >= t.memPercent.critical) note("software", "critical", `メモリ ${p.toFixed(0)}%`);
    else if (p >= t.memPercent.warn) note("software", "warn", `メモリ ${p.toFixed(0)}%`);
  }
  if (basic.load.ok) {
    const cores = Math.max(1, basic.load.value.cores);
    const perCore = basic.load.value["1m"] / cores;
    if (perCore >= t.loadPerCore.critical)
      note("software", "critical", `Load/コア ${perCore.toFixed(2)}`);
    else if (perCore >= t.loadPerCore.warn)
      note("software", "warn", `Load/コア ${perCore.toFixed(2)}`);
  }
  if (basic.disk.ok) {
    for (const d of basic.disk.value) {
      const p = d.usagePercent;
      if (p >= t.diskPercent.critical)
        note("software", "critical", `ディスク ${d.mount} ${p.toFixed(0)}%`);
      else if (p >= t.diskPercent.warn)
        note("software", "warn", `ディスク ${d.mount} ${p.toFixed(0)}%`);
    }
  }
  if (basic.netLink.ok) {
    for (const n of basic.netLink.value) {
      if (n.operstate === "down" || n.carrier === 0) {
        note("hardware", "warn", `NIC ${n.name} リンク無し`);
        note("network", "warn", `NIC ${n.name} リンク無し`);
      }
    }
  }

  // ----- health -----
  if (health) {
    if (health.sensors.ok) {
      const v = health.sensors.value;
      if (v.maxTempC !== null) {
        if (v.maxTempC >= t.tempC.critical)
          note("hardware", "critical", `温度 ${v.maxTempC.toFixed(0)}℃`);
        else if (v.maxTempC >= t.tempC.warn)
          note("hardware", "warn", `温度 ${v.maxTempC.toFixed(0)}℃`);
      }
      if (v.thermalPressure) {
        const limit = v.thermalPressure.cpuSpeedLimit;
        if (limit < t.cpuSpeedLimit.critical)
          note("hardware", "critical", `CPU速度制限 ${limit}%`);
        else if (limit < t.cpuSpeedLimit.warn)
          note("hardware", "warn", `CPU速度制限 ${limit}%`);
      }
    }
    if (health.smart.ok) {
      for (const s of health.smart.value) {
        if (!s.passed) note("hardware", "critical", `SMART ${s.device} ${s.status}`);
      }
    }
    if (health.gateway.ok && health.gateway.value.gateway === null) {
      note("network", "warn", "デフォルト GW 未取得");
    }
    if (health.dns.ok) {
      const failed = health.dns.value.filter((d) => !d.ok);
      if (failed.length > 0) {
        note("network", "warn", `DNS 失敗 ${failed.map((d) => d.host).join(", ")}`);
      }
    }
    if (health.ping.ok) {
      const failed = health.ping.value.filter((p) => !p.ok);
      if (failed.length > 0) {
        note("network", "warn", `ping 失敗 ${failed.map((p) => p.name).join(", ")}`);
      }
    }
  }

  // ----- services -----
  if (services?.ok) {
    for (const s of services.value) {
      if (s.active !== "active") {
        const sev: Severity = s.active === "failed" ? "critical" : "warn";
        note("software", sev, `${s.unit} → ${s.active}`);
      }
    }
  }

  const findings: CategoryFinding[] = [buckets.hardware, buckets.software, buckets.network];
  const overall: Severity = findings.reduce<Severity>((acc, f) => worse(acc, f.severity), "ok");

  let primary: Category | null = null;
  let topRank = 0;
  for (const f of findings) {
    const r = SEV_RANK[f.severity];
    if (r > topRank) {
      topRank = r;
      primary = f.category;
    }
  }

  let message: string;
  if (overall === "ok") {
    message = "サーバは正常に稼働しています。すべての観測項目が良好です。";
  } else {
    const reasons = findings
      .filter((f) => f.severity === "warn" || f.severity === "critical")
      .map((f) => `${CATEGORY_LABEL[f.category]}（${f.hits.join("、")}）`);
    const head = primary
      ? `${CATEGORY_LABEL[primary]}側に問題の可能性があります。`
      : "複合的な問題の可能性があります。";
    message = `${head} 検出: ${reasons.join(" ／ ")}`;
  }

  return { overall, primary, findings, message };
}
