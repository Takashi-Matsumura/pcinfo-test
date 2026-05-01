import { monitorConfig } from "@/config/monitor";
import type {
  BasicData,
  CollectorResult,
  HardwareNetwork,
  ServiceState,
  Severity,
} from "./types";

export type Category = "hardware" | "software" | "network" | "security";

export interface CategoryFinding {
  category: Category;
  severity: Severity;
  hits: string[];
  warnCount: number;
  criticalCount: number;
  score: number;
}

export type Grade = "excellent" | "good" | "caution" | "critical";

export interface SummaryResult {
  overall: Severity;
  primary: Category | null;
  findings: CategoryFinding[];
  message: string;
  score: number;
  grade: Grade;
  gradeLabel: string;
}

const PENALTY: Record<Severity, number> = {
  ok: 0,
  unknown: 0,
  warn: 5,
  critical: 15,
};

const CATEGORY_PENALTY_CAP = 60;

function gradeFromScore(score: number): { grade: Grade; label: string } {
  if (score >= 90) return { grade: "excellent", label: "良好" };
  if (score >= 70) return { grade: "good", label: "概ね正常" };
  if (score >= 40) return { grade: "caution", label: "要注意" };
  return { grade: "critical", label: "異常" };
}

function summarizeHits(hits: string[], maxShow = 3): string {
  if (hits.length <= maxShow) return hits.join("、");
  return `${hits.slice(0, maxShow).join("、")} 他 ${hits.length - maxShow} 件`;
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
  security: "セキュリティ",
};

export interface UserIgnore {
  interfaces?: string[];
  services?: string[];
  diskMounts?: string[];
  smartDevices?: string[];
  pingTargets?: string[];
  dnsHosts?: string[];
}

export interface SummarizeInput {
  basic: BasicData;
  health?: HardwareNetwork;
  services?: CollectorResult<ServiceState[]>;
  userIgnore?: UserIgnore;
}

export function summarize({
  basic,
  health,
  services,
  userIgnore,
}: SummarizeInput): SummaryResult {
  const t = monitorConfig.thresholds;
  const ignore = {
    interfaces: [
      ...monitorConfig.ignore.interfaces,
      ...(userIgnore?.interfaces ?? []),
    ],
    services: [
      ...monitorConfig.ignore.services,
      ...(userIgnore?.services ?? []),
    ],
    diskMounts: [
      ...monitorConfig.ignore.diskMounts,
      ...(userIgnore?.diskMounts ?? []),
    ],
    smartDevices: [
      ...monitorConfig.ignore.smartDevices,
      ...(userIgnore?.smartDevices ?? []),
    ],
    pingTargets: [
      ...monitorConfig.ignore.pingTargets,
      ...(userIgnore?.pingTargets ?? []),
    ],
    dnsHosts: [
      ...monitorConfig.ignore.dnsHosts,
      ...(userIgnore?.dnsHosts ?? []),
    ],
  };
  const mkBucket = (category: Category): CategoryFinding => ({
    category,
    severity: "ok",
    hits: [],
    warnCount: 0,
    criticalCount: 0,
    score: 100,
  });
  const buckets: Record<Category, CategoryFinding> = {
    hardware: mkBucket("hardware"),
    software: mkBucket("software"),
    network: mkBucket("network"),
    security: mkBucket("security"),
  };

  const note = (cat: Category, sev: Severity, msg: string) => {
    const f = buckets[cat];
    f.severity = worse(f.severity, sev);
    if (sev === "warn") {
      f.hits.push(msg);
      f.warnCount += 1;
    } else if (sev === "critical") {
      f.hits.push(msg);
      f.criticalCount += 1;
    }
  };

  // ----- basic (host or docker) -----
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

  if (basic.kind === "docker") {
    if (basic.state.ok) {
      const v = basic.state.value;
      if (!v.running) {
        note("software", "critical", `コンテナ停止中（${v.status}）`);
      } else if (v.health === "unhealthy") {
        note("software", "critical", "health チェック failure");
      } else if (v.health === "starting") {
        note("software", "warn", "health チェック起動中");
      }
    }
    if (basic.restarts.ok && basic.restarts.value.count >= 5) {
      note("software", "warn", `再起動 ${basic.restarts.value.count} 回`);
    }
  } else {
    // host 専用
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
        if (ignore.diskMounts.includes(d.mount)) continue;
        const p = d.usagePercent;
        if (p >= t.diskPercent.critical)
          note("software", "critical", `ディスク ${d.mount} ${p.toFixed(0)}%`);
        else if (p >= t.diskPercent.warn)
          note("software", "warn", `ディスク ${d.mount} ${p.toFixed(0)}%`);
      }
    }
    if (basic.netLink.ok) {
      for (const n of basic.netLink.value) {
        if (ignore.interfaces.includes(n.name)) continue;
        if (n.operstate === "down" || n.carrier === 0) {
          note("hardware", "warn", `NIC ${n.name} リンク無し`);
          note("network", "warn", `NIC ${n.name} リンク無し`);
        }
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
        if (ignore.smartDevices.includes(s.device)) continue;
        if (!s.passed) note("hardware", "critical", `SMART ${s.device} ${s.status}`);
      }
    }
    if (health.gateway.ok && health.gateway.value.gateway === null) {
      note("network", "warn", "デフォルト GW 未取得");
    }
    if (health.dns.ok) {
      const failed = health.dns.value.filter(
        (d) => !d.ok && !ignore.dnsHosts.includes(d.host),
      );
      if (failed.length > 0) {
        note("network", "warn", `DNS 失敗 ${failed.map((d) => d.host).join(", ")}`);
      }
    }
    if (health.ping.ok) {
      const failed = health.ping.value.filter(
        (p) => !p.ok && !ignore.pingTargets.includes(p.name),
      );
      if (failed.length > 0) {
        note("network", "warn", `ping 失敗 ${failed.map((p) => p.name).join(", ")}`);
      }
    }
    if (health.copyfail.ok) {
      const cf = health.copyfail.value;
      if (cf.mitigation === "loaded-vulnerable") {
        note("security", "critical", "Copy Fail (CVE-2026-31431) 緩和未適用：algif_aead ロード中");
      } else if (cf.mitigation === "not-loaded") {
        note("security", "warn", "Copy Fail (CVE-2026-31431) 未確認：algif_aead ブラックリスト未設定");
      }
    }
  }

  // ----- services -----
  if (services?.ok) {
    for (const s of services.value) {
      if (ignore.services.includes(s.unit)) continue;
      if (s.active !== "active") {
        const sev: Severity = s.active === "failed" ? "critical" : "warn";
        note("software", sev, `${s.unit} → ${s.active}`);
      }
    }
  }

  const findings: CategoryFinding[] = [
    buckets.hardware,
    buckets.software,
    buckets.network,
    buckets.security,
  ];

  let totalPenalty = 0;
  for (const f of findings) {
    const raw = f.warnCount * PENALTY.warn + f.criticalCount * PENALTY.critical;
    const capped = Math.min(CATEGORY_PENALTY_CAP, raw);
    f.score = Math.max(0, 100 - capped);
    totalPenalty += capped;
  }
  const score = Math.max(0, Math.min(100, Math.round(100 - totalPenalty)));
  const { grade, label: gradeLabel } = gradeFromScore(score);

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
    message = "全観測項目が正常範囲内です。";
  } else {
    const reasons = findings
      .filter((f) => f.severity === "warn" || f.severity === "critical")
      .map((f) => {
        const counts: string[] = [];
        if (f.criticalCount > 0) counts.push(`異常 ${f.criticalCount}`);
        if (f.warnCount > 0) counts.push(`注意 ${f.warnCount}`);
        return `${CATEGORY_LABEL[f.category]}（${counts.join("・")}：${summarizeHits(f.hits)}）`;
      });
    const head = primary
      ? `主因は${CATEGORY_LABEL[primary]}。`
      : "複合的な問題の可能性。";
    message = `${head} ${reasons.join(" ／ ")}`;
  }

  return { overall, primary, findings, message, score, grade, gradeLabel };
}
