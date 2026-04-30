export type Severity = "ok" | "warn" | "critical" | "unknown";

export type CollectorReason =
  | "unsupported-platform"
  | "not-installed"
  | "permission"
  | "timeout"
  | "parse"
  | "other";

export type CollectorResult<T> =
  | { ok: true; value: T; collectedAt: string }
  | { ok: false; error: string; reason: CollectorReason; collectedAt: string };

export interface DiskEntry {
  device: string;
  mount: string;
  totalBytes: number;
  usedBytes: number;
  usagePercent: number;
}

export interface NetLinkEntry {
  name: string;
  operstate: "up" | "down" | "unknown";
  carrier: 0 | 1;
  speedMbps: number | null;
}

export interface BasicResources {
  cpu: CollectorResult<{ usagePercent: number; cores: number }>;
  mem: CollectorResult<{
    totalBytes: number;
    availableBytes: number;
    usedBytes: number;
    usagePercent: number;
  }>;
  load: CollectorResult<{
    "1m": number;
    "5m": number;
    "15m": number;
    cores: number;
  }>;
  uptime: CollectorResult<{ uptimeSeconds: number; bootEpoch: number }>;
  disk: CollectorResult<DiskEntry[]>;
  netLink: CollectorResult<NetLinkEntry[]>;
}

export interface StatusResponse {
  serverTime: string;
  platform: NodeJS.Platform;
  basic: BasicResources;
}

export interface TempReading {
  sensor: string;
  label: string;
  tempC: number;
}
export interface ThermalPressure {
  cpuSpeedLimit: number;
  schedulerLimit: number | null;
  availableCpus: number | null;
  note: string;
}

export interface SensorsValue {
  maxTempC: number | null;
  readings: TempReading[];
  thermalPressure?: ThermalPressure;
}

export interface SmartReading {
  device: string;
  passed: boolean;
  status: string;
  tempC: number | null;
}

export interface GatewayInfo {
  gateway: string | null;
  iface: string | null;
}

export interface DnsResult {
  host: string;
  ok: boolean;
  addresses: string[];
}

export interface PingResult {
  name: string;
  host: string | null;
  ok: boolean;
  rttMs: number | null;
}

export interface CopyFailStatus {
  kernel: string;
  procVersion: string | null;
  distro: { id: string | null; pretty: string | null };
  algifAeadLoaded: boolean;
  blacklisted: boolean;
  mitigation: "loaded-vulnerable" | "blacklisted" | "not-loaded" | "non-linux";
  note: string;
}

export interface HardwareNetwork {
  sensors: CollectorResult<SensorsValue>;
  smart: CollectorResult<SmartReading[]>;
  gateway: CollectorResult<GatewayInfo>;
  dns: CollectorResult<DnsResult[]>;
  ping: CollectorResult<PingResult[]>;
  copyfail: CollectorResult<CopyFailStatus>;
}

export interface HealthResponse {
  serverTime: string;
  platform: NodeJS.Platform;
  health: HardwareNetwork;
}

export interface ServiceState {
  unit: string;
  active: string;
}

export interface ServicesResponse {
  serverTime: string;
  platform: NodeJS.Platform;
  services: CollectorResult<ServiceState[]>;
}

export interface LogEntry {
  source: "journal" | "kernel";
  line: string;
}

export interface LogsResponse {
  serverTime: string;
  platform: NodeJS.Platform;
  logs: CollectorResult<LogEntry[]>;
}
