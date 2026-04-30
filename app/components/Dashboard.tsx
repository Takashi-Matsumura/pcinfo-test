"use client";
import { useEffect, useState } from "react";
import { StatusTable, type StatusRow } from "./StatusTable";
import { PlainSummary } from "./PlainSummary";
import { LogPanel } from "./LogPanel";
import { monitorConfig } from "@/config/monitor";
import { summarize } from "@/lib/judge";
import { useMuteList, type MuteCategory, type MuteList } from "@/app/hooks/useMuteList";
import type {
  HealthResponse,
  ServicesResponse,
  Severity,
  StatusResponse,
} from "@/lib/types";

function muteState(
  cat: MuteCategory,
  key: string,
  user: MuteList,
): { muted: boolean; origin: "config" | "user" | undefined } {
  const inConfig = monitorConfig.ignore[cat].includes(key);
  const inUser = user[cat].includes(key);
  if (inConfig) return { muted: true, origin: "config" };
  if (inUser) return { muted: true, origin: "user" };
  return { muted: false, origin: undefined };
}

function fmtBytes(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const u = ["B", "KiB", "MiB", "GiB", "TiB", "PiB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < u.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(v < 10 ? 1 : 0)} ${u[i]}`;
}

function fmtUptime(sec: number): string {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d > 0) return `${d}日 ${h}時間`;
  if (h > 0) return `${h}時間 ${m}分`;
  return `${m}分`;
}

function sevByPercent(p: number, warn: number, crit: number): Severity {
  if (!Number.isFinite(p)) return "unknown";
  if (p >= crit) return "critical";
  if (p >= warn) return "warn";
  return "ok";
}

function buildBasicCards(data: StatusResponse, mute: MuteList): StatusRow[] {
  const cards: StatusRow[] = [];
  const t = monitorConfig.thresholds;
  const { cpu, mem, load, uptime, disk, netLink } = data.basic;

  cards.push(
    cpu.ok
      ? {
          id: "cpu",
          title: "CPU 使用率",
          severity: sevByPercent(cpu.value.usagePercent, t.cpuPercent.warn, t.cpuPercent.critical),
          primary: `${cpu.value.usagePercent.toFixed(1)} %`,
          secondary: `論理コア ${cpu.value.cores}`,
          hint: "高止まりが続く場合、過負荷プロセス（ソフト）か発熱による熱抑制（ハード）を疑います。",
        }
      : {
          id: "cpu",
          title: "CPU 使用率",
          severity: "unknown",
          primary: "取得不可",
          secondary: cpu.error,
        },
  );

  cards.push(
    mem.ok
      ? {
          id: "mem",
          title: "メモリ",
          severity: sevByPercent(mem.value.usagePercent, t.memPercent.warn, t.memPercent.critical),
          primary: `${mem.value.usagePercent.toFixed(0)} %`,
          secondary: `${fmtBytes(mem.value.usedBytes)} / ${fmtBytes(mem.value.totalBytes)}`,
          hint: "使用率が高止まりするとアプリが OOM で停止することがあります。",
        }
      : {
          id: "mem",
          title: "メモリ",
          severity: "unknown",
          primary: "取得不可",
          secondary: mem.error,
        },
  );

  if (load.ok) {
    const cores = Math.max(1, load.value.cores);
    const perCore = load.value["1m"] / cores;
    const severity: Severity =
      perCore >= t.loadPerCore.critical
        ? "critical"
        : perCore >= t.loadPerCore.warn
          ? "warn"
          : "ok";
    cards.push({
      id: "load",
      title: "ロードアベレージ",
      severity,
      primary: `${load.value["1m"].toFixed(2)} / ${load.value["5m"].toFixed(2)} / ${load.value["15m"].toFixed(2)}`,
      secondary: `1コア当たり ${perCore.toFixed(2)}（cores=${cores}）`,
      hint: "コア数を超えると待ち行列が伸びている合図。CPU 律速か I/O 律速かは別途確認。",
    });
  } else {
    cards.push({
      id: "load",
      title: "ロードアベレージ",
      severity: "unknown",
      primary: "取得不可",
      secondary: load.error,
    });
  }

  if (uptime.ok) {
    const boot = new Date(uptime.value.bootEpoch * 1000).toLocaleString("ja-JP");
    cards.push({
      id: "uptime",
      title: "アップタイム",
      severity: "ok",
      primary: fmtUptime(uptime.value.uptimeSeconds),
      secondary: `起動 ${boot}`,
      hint: "意図しない再起動の有無を運用記録と照合してください。",
    });
  } else {
    cards.push({
      id: "uptime",
      title: "アップタイム",
      severity: "unknown",
      primary: "取得不可",
      secondary: uptime.error,
    });
  }

  if (disk.ok) {
    if (disk.value.length === 0) {
      cards.push({
        id: "disk",
        title: "ディスク",
        severity: "unknown",
        primary: "対象なし",
        secondary: "df の出力が空でした",
      });
    } else {
      disk.value.forEach((d) => {
        const m = muteState("diskMounts", d.mount, mute);
        cards.push({
          id: `disk-${d.mount}`,
          title: `ディスク ${d.mount}`,
          severity: m.muted
            ? "unknown"
            : sevByPercent(d.usagePercent, t.diskPercent.warn, t.diskPercent.critical),
          primary: `${d.usagePercent.toFixed(0)} %`,
          secondary: `${fmtBytes(d.usedBytes)} / ${fmtBytes(d.totalBytes)}（${d.device}）`,
          hint: "満杯間際だとログ書き込みやアップデートが失敗してアプリが落ちる原因に。",
          muted: m.muted,
          muteCategory: "diskMounts",
          muteKey: d.mount,
          muteOrigin: m.origin,
        });
      });
    }
  } else {
    cards.push({
      id: "disk",
      title: "ディスク",
      severity: "unknown",
      primary: "取得不可",
      secondary: disk.error,
    });
  }

  if (netLink.ok) {
    netLink.value.forEach((n) => {
      const m = muteState("interfaces", n.name, mute);
      const severity: Severity = m.muted
        ? "unknown"
        : n.operstate === "up" && n.carrier === 1
          ? "ok"
          : n.operstate === "down" || n.carrier === 0
            ? "critical"
            : "unknown";
      cards.push({
        id: `nic-${n.name}`,
        title: `NIC ${n.name}`,
        severity,
        primary:
          n.operstate === "up" && n.carrier === 1
            ? "リンクアップ"
            : n.operstate === "down"
              ? "リンクダウン"
              : "キャリア無し",
        secondary: n.speedMbps ? `${n.speedMbps} Mbps` : undefined,
        hint: "ケーブル抜け／HUB 故障／NIC 故障の可能性。LAN ポートの LED と合わせて確認。",
        muted: m.muted,
        muteCategory: "interfaces",
        muteKey: n.name,
        muteOrigin: m.origin,
      });
    });
  } else {
    cards.push({
      id: "nic",
      title: "NIC リンク",
      severity: "unknown",
      primary: "取得不可",
      secondary: netLink.error,
    });
  }
  return cards;
}

function buildHardwareCards(h: HealthResponse, mute: MuteList): StatusRow[] {
  const t = monitorConfig.thresholds;
  const cards: StatusRow[] = [];
  const { sensors, smart } = h.health;

  if (sensors.ok) {
    const v = sensors.value;
    if (v.thermalPressure) {
      const tp = v.thermalPressure;
      const severity: Severity =
        tp.cpuSpeedLimit < t.cpuSpeedLimit.critical
          ? "critical"
          : tp.cpuSpeedLimit < t.cpuSpeedLimit.warn
            ? "warn"
            : "ok";
      cards.push({
        id: "thermal-pressure",
        title: "熱状態（CPU 速度制限）",
        severity,
        primary: `${tp.cpuSpeedLimit} %`,
        secondary: tp.note,
        hint: "100% 未満は熱抑制中。ファン詰まり／吸排気の塞ぎ／室温／粉塵を確認。",
      });
    }
    if (v.maxTempC !== null) {
      const max = v.maxTempC;
      const severity: Severity =
        max >= t.tempC.critical ? "critical" : max >= t.tempC.warn ? "warn" : "ok";
      cards.push({
        id: "temp",
        title: "温度（最大値）",
        severity,
        primary: `${max.toFixed(0)} ℃`,
        secondary: v.readings
          .slice(0, 3)
          .map((r) => `${r.label} ${r.tempC.toFixed(0)}℃`)
          .join(" / "),
        hint: "高温が続く場合、ファン詰まり／室温／ハードウェア故障の可能性。",
      });
    }
    if (!v.thermalPressure && v.maxTempC === null) {
      cards.push({
        id: "temp",
        title: "温度／熱状態",
        severity: "unknown",
        primary: "対象なし",
        secondary: "センサ情報を取得できませんでした",
      });
    }
  } else {
    cards.push({
      id: "temp",
      title: "温度／熱状態",
      severity: "unknown",
      primary: sensors.reason === "not-installed" ? "コマンド未インストール" : "取得不可",
      secondary: sensors.error,
    });
  }

  if (smart.ok) {
    if (smart.value.length === 0) {
      cards.push({
        id: "smart",
        title: "ストレージ SMART",
        severity: "unknown",
        primary: "対象未設定",
        secondary: "config/monitor.ts の smartDevices に device を追加してください",
      });
    } else {
      smart.value.forEach((s) => {
        const m = muteState("smartDevices", s.device, mute);
        cards.push({
          id: `smart-${s.device}`,
          title: `SMART ${s.device}`,
          severity: m.muted ? "unknown" : s.passed ? "ok" : "critical",
          primary: s.status,
          secondary: s.tempC !== null ? `温度 ${s.tempC} ℃` : undefined,
          hint: "FAILED / 不明 はディスク故障の前兆。早急にバックアップと交換準備を。",
          muted: m.muted,
          muteCategory: "smartDevices",
          muteKey: s.device,
          muteOrigin: m.origin,
        });
      });
    }
  } else {
    cards.push({
      id: "smart",
      title: "ストレージ SMART",
      severity: "unknown",
      primary: smart.reason === "not-installed" ? "smartmontools 未インストール" : "取得不可",
      secondary: smart.error,
    });
  }

  return cards;
}

function buildNetworkCards(h: HealthResponse, mute: MuteList): StatusRow[] {
  const cards: StatusRow[] = [];
  const { gateway, dns, ping } = h.health;

  if (gateway.ok) {
    const gw = gateway.value.gateway;
    cards.push({
      id: "gateway",
      title: "デフォルトゲートウェイ",
      severity: gw ? "ok" : "warn",
      primary: gw ?? "未設定",
      secondary: gateway.value.iface ? `経由 IF: ${gateway.value.iface}` : undefined,
      hint: "GW が無いと外部通信が成立しません。NIC 設定／ルータ設定を確認。",
    });
  } else {
    cards.push({
      id: "gateway",
      title: "デフォルトゲートウェイ",
      severity: "unknown",
      primary: "取得不可",
      secondary: gateway.error,
    });
  }

  if (dns.ok) {
    const ignored = [...monitorConfig.ignore.dnsHosts, ...mute.dnsHosts];
    const considered = dns.value.filter((d) => !ignored.includes(d.host));
    const failed = considered.filter((d) => !d.ok);
    cards.push({
      id: "dns",
      title: "DNS 解決",
      severity: failed.length === 0 ? "ok" : "warn",
      primary:
        failed.length === 0
          ? `${considered.length} 件すべて成功`
          : `${failed.length} 件失敗`,
      secondary: dns.value
        .map((d) => {
          const mark = d.ok ? "✓" : "✗";
          return ignored.includes(d.host) ? `${d.host} (除外)` : `${d.host} ${mark}`;
        })
        .join(" / "),
      hint: "DNS だけ失敗するなら resolv.conf / 上流 DNS の問題。",
    });
  } else {
    cards.push({
      id: "dns",
      title: "DNS 解決",
      severity: "unknown",
      primary: "取得不可",
      secondary: dns.error,
    });
  }

  if (ping.ok) {
    ping.value.forEach((p) => {
      const m = muteState("pingTargets", p.name, mute);
      cards.push({
        id: `ping-${p.name}`,
        title: `ping ${p.name}`,
        severity: m.muted ? "unknown" : p.ok ? "ok" : "warn",
        primary: p.ok ? `${p.rttMs?.toFixed(1) ?? "?"} ms` : "応答なし",
        secondary: p.host ?? "宛先未解決",
        hint: "GW のみ NG → ローカル網／NIC、外部のみ NG → ISP・ルータ側を疑います。",
        muted: m.muted,
        muteCategory: "pingTargets",
        muteKey: p.name,
        muteOrigin: m.origin,
      });
    });
  } else {
    cards.push({
      id: "ping",
      title: "ping",
      severity: "unknown",
      primary: "取得不可",
      secondary: ping.error,
    });
  }

  return cards;
}

function buildSecurityCards(h: HealthResponse): StatusRow[] {
  const { copyfail } = h.health;
  if (!copyfail.ok) {
    return [
      {
        id: "copyfail",
        title: "Copy Fail (CVE-2026-31431)",
        severity: "unknown",
        primary: "取得不可",
        secondary: copyfail.error,
      },
    ];
  }
  const v = copyfail.value;
  if (v.mitigation === "non-linux") {
    return [
      {
        id: "copyfail",
        title: "Copy Fail (CVE-2026-31431)",
        severity: "ok",
        primary: "対象外",
        secondary: "Linux 専用の脆弱性",
        hint: v.note,
      },
    ];
  }
  const severity: Severity =
    v.mitigation === "loaded-vulnerable"
      ? "critical"
      : v.mitigation === "not-loaded"
        ? "warn"
        : "ok";
  const primary =
    v.mitigation === "loaded-vulnerable"
      ? "脆弱モジュールがロード中"
      : v.mitigation === "blacklisted"
        ? "ブラックリスト済（緩和適用）"
        : "未ロード（要確認）";
  const distroLabel = v.distro.pretty ?? v.distro.id ?? "ディストリ不明";
  return [
    {
      id: "copyfail",
      title: "Copy Fail (CVE-2026-31431)",
      severity,
      primary,
      secondary: `${distroLabel} ／ kernel ${v.kernel}`,
      hint: v.note,
    },
  ];
}

function buildServiceCards(s: ServicesResponse, mute: MuteList): StatusRow[] {
  if (!s.services.ok) {
    return [
      {
        id: "services",
        title: "systemd サービス",
        severity: "unknown",
        primary: "取得不可",
        secondary: s.services.error,
      },
    ];
  }
  if (s.services.value.length === 0) {
    return [
      {
        id: "services-empty",
        title: "systemd サービス",
        severity: "unknown",
        primary: "対象未設定",
        secondary: "config/monitor.ts の systemdUnits を編集してください",
      },
    ];
  }
  return s.services.value.map((u) => {
    const m = muteState("services", u.unit, mute);
    const severity: Severity = m.muted
      ? "unknown"
      : u.active === "active"
        ? "ok"
        : u.active === "failed"
          ? "critical"
          : "warn";
    return {
      id: `svc-${u.unit}`,
      title: u.unit,
      severity,
      primary: u.active,
      hint:
        u.active === "active"
          ? undefined
          : "サービス停止／起動失敗。ソフト側の典型的な障害。`systemctl status <unit>` で詳細確認。",
      muted: m.muted,
      muteCategory: "services",
      muteKey: u.unit,
      muteOrigin: m.origin,
    };
  });
}

interface PollState<T> {
  data: T | null;
  error: string | null;
  fails: number;
  lastFetchedAt: number | null;
}

function usePolling<T>(url: string, intervalMs: number): PollState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fails, setFails] = useState(0);
  const [lastFetchedAt, setLastFetchedAt] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    let abort: AbortController | null = null;
    const tick = async () => {
      abort?.abort();
      abort = new AbortController();
      try {
        const res = await fetch(url, { signal: abort.signal, cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as T;
        if (!alive) return;
        setData(json);
        setError(null);
        setLastFetchedAt(Date.now());
        setFails(0);
      } catch (e) {
        if (!alive) return;
        if (e instanceof DOMException && e.name === "AbortError") return;
        setFails((n) => n + 1);
        setError(e instanceof Error ? e.message : String(e));
      }
    };
    tick();
    const id = setInterval(tick, intervalMs);
    return () => {
      alive = false;
      abort?.abort();
      clearInterval(id);
    };
  }, [url, intervalMs]);

  return { data, error, fails, lastFetchedAt };
}

export function Dashboard() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const { muteList, toggleMute } = useMuteList();

  const status = usePolling<StatusResponse>(
    "/api/status",
    monitorConfig.refreshIntervalsMs.status,
  );
  const health = usePolling<HealthResponse>(
    "/api/health",
    monitorConfig.refreshIntervalsMs.health,
  );
  const services = usePolling<ServicesResponse>(
    "/api/services",
    monitorConfig.refreshIntervalsMs.services,
  );

  const stale = status.error !== null && status.fails >= 3;
  const lastAgo =
    status.lastFetchedAt !== null
      ? Math.floor((now - status.lastFetchedAt) / 1000)
      : null;

  const summary = status.data
    ? summarize({
        basic: status.data.basic,
        health: health.data?.health,
        services: services.data?.services,
        userIgnore: muteList,
      })
    : null;

  return (
    <div className="space-y-6">
      <header className="flex items-baseline justify-between flex-wrap gap-3">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          サーバ状態モニター
        </h1>
        <div className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-3 flex-wrap">
          {stale ? (
            <span className="text-rose-600 dark:text-rose-400 font-medium">
              サーバ応答なし（{status.fails} 回連続失敗）
            </span>
          ) : null}
          {!stale && lastAgo !== null ? <span>最終取得 {lastAgo} 秒前</span> : null}
          {status.data ? (
            <span>
              サーバ時刻 {new Date(status.data.serverTime).toLocaleTimeString("ja-JP")} ／ OS{" "}
              <code className="font-mono">{status.data.platform}</code>
            </span>
          ) : null}
        </div>
      </header>

      {summary ? (
        <PlainSummary
          severity={stale ? "unknown" : summary.overall}
          message={
            stale
              ? "監視サーバから応答がありません。ダッシュボード自身か中継経路の問題かもしれません。"
              : summary.message
          }
          score={summary.score}
          gradeLabel={summary.gradeLabel}
          grade={summary.grade}
          findings={summary.findings}
          unavailable={stale}
        />
      ) : null}

      <StatusTable
        title="基本リソース"
        rows={status.data ? buildBasicCards(status.data, muteList) : []}
        emptyMessage={status.error ? `取得失敗: ${status.error}` : "読み込み中…"}
        onToggleMute={toggleMute}
      />

      <StatusTable
        title="ハードウェア健全性"
        rows={health.data ? buildHardwareCards(health.data, muteList) : []}
        emptyMessage={health.error ? `取得失敗: ${health.error}` : "読み込み中…"}
        onToggleMute={toggleMute}
      />

      <StatusTable
        title="ネットワーク疎通"
        rows={health.data ? buildNetworkCards(health.data, muteList) : []}
        emptyMessage={health.error ? `取得失敗: ${health.error}` : "読み込み中…"}
        onToggleMute={toggleMute}
      />

      <StatusTable
        title="カーネルセキュリティ"
        rows={health.data ? buildSecurityCards(health.data) : []}
        emptyMessage={health.error ? `取得失敗: ${health.error}` : "読み込み中…"}
      />

      <StatusTable
        title="systemd サービス"
        rows={services.data ? buildServiceCards(services.data, muteList) : []}
        emptyMessage={services.error ? `取得失敗: ${services.error}` : "読み込み中…"}
        onToggleMute={toggleMute}
      />

      <LogPanel />
    </div>
  );
}
