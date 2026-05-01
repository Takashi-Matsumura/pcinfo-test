import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { monitorConfig } from "@/config/monitor";
import { collectCpu } from "@/lib/collectors/cpu";
import { collectMem } from "@/lib/collectors/mem";
import { collectLoad } from "@/lib/collectors/load";
import { collectUptime } from "@/lib/collectors/uptime";
import { collectDisk } from "@/lib/collectors/disk";
import { collectNetLink } from "@/lib/collectors/net-link";
import { collectDockerStats } from "@/lib/collectors/docker";
import { mockBasicResources } from "@/lib/collectors/mock";
import { resolveTarget, targetRef } from "@/lib/targets";
import type { BasicData, BasicResources, StatusResponse } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function collectHostBasic(): Promise<BasicResources> {
  const [cpu, mem, load, uptime, disk, netLink] = await Promise.all([
    collectCpu(),
    collectMem(),
    collectLoad(),
    collectUptime(),
    collectDisk(monitorConfig.diskMounts.length > 0 ? monitorConfig.diskMounts : undefined),
    collectNetLink(
      monitorConfig.networkInterfaces.length > 0 ? monitorConfig.networkInterfaces : undefined,
    ),
  ]);
  return { cpu, mem, load, uptime, disk, netLink };
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const r = resolveTarget(url.searchParams);
  if (!r.ok) {
    return NextResponse.json({ error: r.message }, { status: r.status });
  }
  const target = r.target;

  const useMock = process.env.MONITOR_DEV_MOCK === "1";
  let basic: BasicData;

  if (target.kind === "host") {
    const host = useMock ? mockBasicResources() : await collectHostBasic();
    basic = { kind: "host", ...host };
  } else if (target.kind === "docker") {
    const docker = await collectDockerStats(target.containerName);
    basic = { kind: "docker", ...docker };
  } else {
    return NextResponse.json(
      { error: `target kind "${target.kind}" は未対応` },
      { status: 501 },
    );
  }

  const body: StatusResponse = {
    serverTime: new Date().toISOString(),
    platform: process.platform,
    target: targetRef(target),
    basic,
  };
  return NextResponse.json(body, {
    headers: { "Cache-Control": "no-store" },
  });
}
