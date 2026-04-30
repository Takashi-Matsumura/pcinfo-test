export const monitorConfig = {
  thresholds: {
    cpuPercent: { warn: 85, critical: 95 },
    memPercent: { warn: 85, critical: 95 },
    diskPercent: { warn: 80, critical: 92 },
    loadPerCore: { warn: 1.0, critical: 1.5 },
    tempC: { warn: 75, critical: 90 },
    cpuSpeedLimit: { warn: 99, critical: 80 },
  },
  diskMounts: [] as string[],
  smartDevices: [] as string[],
  networkInterfaces: [] as string[],
  pingTargets: [
    { name: "デフォルトGW", host: "__gateway__" as const },
    { name: "Cloudflare DNS", host: "1.1.1.1" },
    { name: "Google DNS", host: "8.8.8.8" },
  ],
  dnsTestHosts: ["example.com", "cloudflare.com"],
  services: [] as string[],
  log: {
    journalctlLines: 50,
    dmesgLines: 50,
  },
  refreshIntervalsMs: {
    status: 5000,
    health: 30000,
    services: 10000,
  },
} as const;

export type MonitorConfig = typeof monitorConfig;
