import "server-only";
import Docker from "dockerode";
import type {
  CollectorResult,
  ContainerBasicResources,
  ContainerState,
} from "@/lib/types";

let client: Docker | null = null;
function getDocker(): Docker {
  if (!client) {
    client = new Docker();
  }
  return client;
}

interface DockerStats {
  cpu_stats: {
    cpu_usage: { total_usage: number };
    system_cpu_usage?: number;
    online_cpus?: number;
  };
  precpu_stats: {
    cpu_usage: { total_usage: number };
    system_cpu_usage?: number;
  };
  memory_stats: {
    usage?: number;
    limit?: number;
    stats?: Record<string, number>;
  };
  networks?: Record<string, { rx_bytes: number; tx_bytes: number }>;
}

function calcCpuPercent(s: DockerStats): { percent: number; onlineCpus: number } {
  const cpuDelta =
    s.cpu_stats.cpu_usage.total_usage - s.precpu_stats.cpu_usage.total_usage;
  const sys = s.cpu_stats.system_cpu_usage ?? 0;
  const presys = s.precpu_stats.system_cpu_usage ?? 0;
  const systemDelta = sys - presys;
  const onlineCpus = s.cpu_stats.online_cpus ?? 1;
  if (systemDelta <= 0 || cpuDelta <= 0) {
    return { percent: 0, onlineCpus };
  }
  return { percent: (cpuDelta / systemDelta) * onlineCpus * 100, onlineCpus };
}

function calcMem(s: DockerStats): { used: number; limit: number; percent: number } {
  const usage = s.memory_stats.usage ?? 0;
  const cache = s.memory_stats.stats?.cache ?? 0;
  const inactive = s.memory_stats.stats?.inactive_file ?? 0;
  const used = Math.max(0, usage - Math.max(cache, inactive));
  const limit = s.memory_stats.limit ?? 0;
  const percent = limit > 0 ? (used / limit) * 100 : 0;
  return { used, limit, percent };
}

function calcNetwork(s: DockerStats): { rx: number; tx: number } {
  const nets = Object.values(s.networks ?? {});
  return {
    rx: nets.reduce((sum, n) => sum + n.rx_bytes, 0),
    tx: nets.reduce((sum, n) => sum + n.tx_bytes, 0),
  };
}

function errResult<T>(error: unknown, reason: "permission" | "not-installed" | "other"): CollectorResult<T> {
  return {
    ok: false,
    error: error instanceof Error ? error.message : String(error),
    reason,
    collectedAt: new Date().toISOString(),
  };
}

export async function collectDockerStats(
  containerName: string,
): Promise<ContainerBasicResources> {
  const collectedAt = new Date().toISOString();
  const docker = getDocker();

  let inspect: Docker.ContainerInspectInfo;
  let stats: DockerStats | null = null;
  let listed: { name: string; id: string } | null = null;

  try {
    const containers = await docker.listContainers({ all: true });
    const found = containers.find((c) =>
      c.Names.some((n) => n === `/${containerName}` || n === containerName),
    );
    if (!found) {
      const err: CollectorResult<never> = {
        ok: false,
        error: `container "${containerName}" not found`,
        reason: "other",
        collectedAt,
      };
      return {
        cpu: err,
        mem: err,
        state: err,
        uptime: err,
        network: err,
        restarts: err,
        image: err,
      };
    }
    listed = { name: containerName, id: found.Id };
    const c = docker.getContainer(found.Id);
    inspect = await c.inspect();

    if (inspect.State.Running) {
      stats = (await c.stats({ stream: false })) as unknown as DockerStats;
    }
  } catch (e) {
    const err = errResult<never>(e, "other");
    return {
      cpu: err,
      mem: err,
      state: err,
      uptime: err,
      network: err,
      restarts: err,
      image: err,
    };
  }

  const state: ContainerState = {
    status: inspect.State.Status,
    running: inspect.State.Running,
    startedAt: inspect.State.StartedAt ?? null,
    exitCode: inspect.State.ExitCode ?? null,
    health: inspect.State.Health?.Status ?? null,
  };

  const startedAtMs = state.startedAt ? Date.parse(state.startedAt) : NaN;
  const uptimeOk = state.running && Number.isFinite(startedAtMs);
  const uptimeSeconds = uptimeOk
    ? Math.max(0, Math.floor((Date.now() - startedAtMs) / 1000))
    : 0;

  let cpu: ContainerBasicResources["cpu"];
  let mem: ContainerBasicResources["mem"];
  let network: ContainerBasicResources["network"];
  if (stats) {
    const c = calcCpuPercent(stats);
    cpu = {
      ok: true,
      value: { usagePercent: c.percent, onlineCpus: c.onlineCpus },
      collectedAt,
    };
    const m = calcMem(stats);
    mem = {
      ok: true,
      value: { usedBytes: m.used, limitBytes: m.limit, usagePercent: m.percent },
      collectedAt,
    };
    const n = calcNetwork(stats);
    network = { ok: true, value: { rxBytes: n.rx, txBytes: n.tx }, collectedAt };
  } else {
    const stopped: CollectorResult<never> = {
      ok: false,
      error: "container not running",
      reason: "other",
      collectedAt,
    };
    cpu = stopped;
    mem = stopped;
    network = stopped;
  }

  return {
    cpu,
    mem,
    network,
    state: { ok: true, value: state, collectedAt },
    uptime: uptimeOk
      ? {
          ok: true,
          value: { uptimeSeconds, startedAt: state.startedAt! },
          collectedAt,
        }
      : {
          ok: false,
          error: state.running ? "startedAt unavailable" : "container not running",
          reason: "other",
          collectedAt,
        },
    restarts: {
      ok: true,
      value: { count: inspect.RestartCount ?? 0 },
      collectedAt,
    },
    image: {
      ok: true,
      value: {
        image: inspect.Config.Image,
        imageId: inspect.Image,
      },
      collectedAt,
    },
  };
  void listed;
}

export async function listDockerContainers(): Promise<
  Array<{ name: string; image: string; status: string; running: boolean }>
> {
  try {
    const docker = getDocker();
    const list = await docker.listContainers({ all: true });
    return list.map((c) => ({
      name: (c.Names[0] ?? "").replace(/^\//, ""),
      image: c.Image,
      status: c.Status,
      running: c.State === "running",
    }));
  } catch {
    return [];
  }
}
