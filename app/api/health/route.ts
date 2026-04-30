import "server-only";
import { NextResponse } from "next/server";
import { monitorConfig } from "@/config/monitor";
import { collectSensors } from "@/lib/collectors/sensors";
import { collectSmart } from "@/lib/collectors/smart";
import { collectGateway } from "@/lib/collectors/gateway";
import { collectDns } from "@/lib/collectors/dns";
import { collectPing } from "@/lib/collectors/ping";
import { collectCopyFail } from "@/lib/collectors/copyfail";
import { mockHealth } from "@/lib/collectors/mock";
import type { HardwareNetwork, HealthResponse } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function collectHealthReal(): Promise<HardwareNetwork> {
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

export async function GET() {
  const useMock = process.env.MONITOR_DEV_MOCK === "1";
  const health = useMock ? mockHealth() : await collectHealthReal();
  const body: HealthResponse = {
    serverTime: new Date().toISOString(),
    platform: process.platform,
    health,
  };
  return NextResponse.json(body, {
    headers: { "Cache-Control": "no-store" },
  });
}
