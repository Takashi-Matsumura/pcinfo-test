import "server-only";
import { NextResponse } from "next/server";
import { monitorConfig, topologyConfig } from "@/config/monitor";
import { listTargets, targetRef } from "@/lib/targets";
import { collectCpu } from "@/lib/collectors/cpu";
import { collectMem } from "@/lib/collectors/mem";
import { collectLoad } from "@/lib/collectors/load";
import { collectUptime } from "@/lib/collectors/uptime";
import { collectDisk } from "@/lib/collectors/disk";
import { collectNetLink } from "@/lib/collectors/net-link";
import { collectSensors } from "@/lib/collectors/sensors";
import { collectSmart } from "@/lib/collectors/smart";
import { collectGateway } from "@/lib/collectors/gateway";
import { collectDns } from "@/lib/collectors/dns";
import { collectPing } from "@/lib/collectors/ping";
import { collectCopyFail } from "@/lib/collectors/copyfail";
import { collectServices } from "@/lib/collectors/services";
import { collectDockerStats } from "@/lib/collectors/docker";
import { runProbes } from "@/lib/probes";
import { mockBasicResources, mockHealth, mockServices } from "@/lib/collectors/mock";
import { summarize } from "@/lib/judge";
import type {
  BasicData,
  HardwareNetwork,
  OverviewResponse,
  Target,
  TargetOverview,
} from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function collectHostBasic() {
  const [cpu, mem, load, uptime, disk, netLink] = await Promise.all([
    collectCpu(),
    collectMem(),
    collectLoad(),
    collectUptime(),
    collectDisk(monitorConfig.diskMounts.length > 0 ? monitorConfig.diskMounts : undefined),
    collectNetLink(
      monitorConfig.networkInterfaces.length > 0
        ? monitorConfig.networkInterfaces
        : undefined,
    ),
  ]);
  return { cpu, mem, load, uptime, disk, netLink };
}

async function collectHostHealth(): Promise<HardwareNetwork> {
  const [sensors, smart, gateway, copyfail] = await Promise.all([
    collectSensors(),
    collectSmart(monitorConfig.smartDevices),
    collectGateway(),
    collectCopyFail(),
  ]);
  const gatewayIp = gateway.ok ? gateway.value.gateway : null;
  const [dns, ping] = await Promise.all([
    collectDns(monitorConfig.dnsTestHosts),
    collectPing(monitorConfig.pingTargets, gatewayIp),
  ]);
  return { sensors, smart, gateway, dns, ping, copyfail };
}

async function summarizeTarget(target: Target): Promise<TargetOverview> {
  const useMock = process.env.MONITOR_DEV_MOCK === "1";
  const ref = targetRef(target);
  try {
    if (target.kind === "host") {
      const host = useMock ? mockBasicResources() : await collectHostBasic();
      const basic: BasicData = { kind: "host", ...host };
      const [health, services] = await Promise.all([
        useMock ? Promise.resolve(mockHealth()) : collectHostHealth(),
        useMock
          ? Promise.resolve(mockServices())
          : collectServices(monitorConfig.services),
      ]);
      const s = summarize({ basic, health, services });
      return {
        ref,
        severity: s.overall,
        grade: s.grade,
        gradeLabel: s.gradeLabel,
        score: s.score,
        primary: s.primary,
        message: s.message,
      };
    }
    if (target.kind === "docker") {
      const docker = await collectDockerStats(target.containerName);
      const basic: BasicData = { kind: "docker", ...docker };
      const list = target.probes ?? [];
      const collectedAt = new Date().toISOString();
      const probes =
        list.length === 0
          ? { ok: true as const, value: [], collectedAt }
          : { ok: true as const, value: await runProbes(list), collectedAt };
      const s = summarize({ basic, probes });
      return {
        ref,
        severity: s.overall,
        grade: s.grade,
        gradeLabel: s.gradeLabel,
        score: s.score,
        primary: s.primary,
        message: s.message,
      };
    }
    // service kind: probes のみ
    const collectedAt = new Date().toISOString();
    const probes =
      target.probes.length === 0
        ? { ok: true as const, value: [], collectedAt }
        : { ok: true as const, value: await runProbes(target.probes), collectedAt };
    // service kind は basic を持たないので、ダミーで host 0% を渡す
    const basic: BasicData = {
      kind: "host",
      cpu: { ok: false, error: "n/a", reason: "other", collectedAt },
      mem: { ok: false, error: "n/a", reason: "other", collectedAt },
      load: { ok: false, error: "n/a", reason: "other", collectedAt },
      uptime: { ok: false, error: "n/a", reason: "other", collectedAt },
      disk: { ok: false, error: "n/a", reason: "other", collectedAt },
      netLink: { ok: false, error: "n/a", reason: "other", collectedAt },
    };
    const s = summarize({ basic, probes });
    return {
      ref,
      severity: s.overall,
      grade: s.grade,
      gradeLabel: s.gradeLabel,
      score: s.score,
      primary: s.primary,
      message: s.message,
    };
  } catch (e) {
    return {
      ref,
      severity: "unknown",
      grade: "caution",
      gradeLabel: "取得不可",
      score: 0,
      primary: null,
      message: "概観の取得に失敗しました",
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

export async function GET() {
  const targets = listTargets();
  const overviews = await Promise.all(targets.map((t) => summarizeTarget(t)));
  const body: OverviewResponse = {
    serverTime: new Date().toISOString(),
    platform: process.platform,
    targets: overviews,
    links: topologyConfig.links,
  };
  return NextResponse.json(body, {
    headers: { "Cache-Control": "no-store" },
  });
}
