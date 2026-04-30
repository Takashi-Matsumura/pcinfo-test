import "server-only";
import os from "node:os";
import type {
  BasicResources,
  CollectorResult,
  HardwareNetwork,
  LogEntry,
  ServiceState,
} from "@/lib/types";

function wave(period: number, amp: number, base: number): number {
  const t = Date.now() / 1000;
  return base + amp * Math.sin((2 * Math.PI * t) / period);
}

export function mockBasicResources(): BasicResources {
  const now = new Date().toISOString();
  const cores = Math.max(2, os.cpus().length);
  const cpuPct = Math.max(0, Math.min(100, wave(60, 30, 45)));
  const memTotal = 16 * 1024 ** 3;
  const memUsedPct = Math.max(0, Math.min(100, wave(120, 15, 60)));
  const memUsed = Math.floor((memUsedPct / 100) * memTotal);
  const diskTotal = 500 * 1024 ** 3;
  const diskUsedPct = Math.max(0, Math.min(100, wave(900, 5, 55)));
  const diskUsed = Math.floor((diskUsedPct / 100) * diskTotal);
  const load1 = Math.max(0, wave(45, cores * 0.4, cores * 0.6));
  const uptimeSec = 60 * 60 * 24 * 3 + 60 * 60 * 5;

  return {
    cpu: { ok: true, value: { usagePercent: cpuPct, cores }, collectedAt: now },
    mem: {
      ok: true,
      value: {
        totalBytes: memTotal,
        availableBytes: memTotal - memUsed,
        usedBytes: memUsed,
        usagePercent: memUsedPct,
      },
      collectedAt: now,
    },
    load: {
      ok: true,
      value: {
        "1m": load1,
        "5m": load1 * 0.85,
        "15m": load1 * 0.7,
        cores,
      },
      collectedAt: now,
    },
    uptime: {
      ok: true,
      value: {
        uptimeSeconds: uptimeSec,
        bootEpoch: Math.floor(Date.now() / 1000 - uptimeSec),
      },
      collectedAt: now,
    },
    disk: {
      ok: true,
      value: [
        {
          device: "/dev/mock-root",
          mount: "/",
          totalBytes: diskTotal,
          usedBytes: diskUsed,
          usagePercent: diskUsedPct,
        },
        {
          device: "/dev/mock-data",
          mount: "/var",
          totalBytes: diskTotal * 2,
          usedBytes: Math.floor(diskTotal * 2 * 0.32),
          usagePercent: 32,
        },
      ],
      collectedAt: now,
    },
    netLink: {
      ok: true,
      value: [
        { name: "eth0", operstate: "up", carrier: 1, speedMbps: 1000 },
        { name: "wlan0", operstate: "down", carrier: 0, speedMbps: null },
      ],
      collectedAt: now,
    },
  };
}

export function mockHealth(): HardwareNetwork {
  const now = new Date().toISOString();
  const tempC = wave(180, 12, 55);
  return {
    sensors: {
      ok: true,
      value: {
        maxTempC: process.platform === "darwin" ? null : tempC,
        readings:
          process.platform === "darwin"
            ? []
            : [
                { sensor: "coretemp-isa-0000", label: "Package id 0", tempC },
                { sensor: "coretemp-isa-0000", label: "Core 0", tempC: tempC - 3 },
              ],
        thermalPressure:
          process.platform === "darwin"
            ? {
                cpuSpeedLimit: 100,
                schedulerLimit: 100,
                availableCpus: 10,
                note: "現在、熱警告は記録されていません（モック）",
              }
            : undefined,
      },
      collectedAt: now,
    },
    smart: {
      ok: true,
      value: [
        { device: "/dev/mock-sda", passed: true, status: "PASSED", tempC: 36 },
      ],
      collectedAt: now,
    },
    gateway: {
      ok: true,
      value: { gateway: "192.168.1.1", iface: "eth0" },
      collectedAt: now,
    },
    dns: {
      ok: true,
      value: [
        { host: "example.com", ok: true, addresses: ["93.184.216.34"] },
        { host: "cloudflare.com", ok: true, addresses: ["104.16.132.229"] },
      ],
      collectedAt: now,
    },
    ping: {
      ok: true,
      value: [
        { name: "デフォルトGW", host: "192.168.1.1", ok: true, rttMs: 0.4 },
        { name: "Cloudflare DNS", host: "1.1.1.1", ok: true, rttMs: 12.7 },
        { name: "Google DNS", host: "8.8.8.8", ok: true, rttMs: 14.1 },
      ],
      collectedAt: now,
    },
    copyfail: {
      ok: true,
      value: {
        kernel: "6.8.0-mock-generic",
        procVersion: "Linux version 6.8.0-mock-generic (mock@build) (gcc 13.2.0)",
        distro: { id: "ubuntu", pretty: "Ubuntu 24.04 LTS (mock)" },
        algifAeadLoaded: true,
        blacklisted: false,
        mitigation: "loaded-vulnerable",
        note:
          "algif_aead モジュールがロード中。CVE-2026-31431 の脆弱コードがアクティブです（モック）。",
      },
      collectedAt: now,
    },
  };
}

export function mockServices(): CollectorResult<ServiceState[]> {
  return {
    ok: true,
    value: [
      { unit: "ssh.service", active: "active" },
      { unit: "nginx.service", active: "active" },
      { unit: "demo-broken.service", active: "failed" },
    ],
    collectedAt: new Date().toISOString(),
  };
}

export function mockLogs(): CollectorResult<LogEntry[]> {
  return {
    ok: true,
    value: [
      {
        source: "journal",
        line: "2026-04-30T20:12:11+0900 host kernel: usb 1-2: device disconnect",
      },
      {
        source: "journal",
        line: "2026-04-30T20:13:55+0900 host nginx[1234]: 502 bad gateway upstream timeout",
      },
      {
        source: "kernel",
        line: "[Wed Apr 30 20:14:01 2026] EXT4-fs warning: Mount option 'data=writeback' will be removed",
      },
    ],
    collectedAt: new Date().toISOString(),
  };
}
