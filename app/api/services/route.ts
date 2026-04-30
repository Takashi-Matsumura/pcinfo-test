import "server-only";
import { NextResponse } from "next/server";
import { monitorConfig } from "@/config/monitor";
import { collectServices } from "@/lib/collectors/services";
import { mockServices } from "@/lib/collectors/mock";
import type { ServicesResponse } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const useMock = process.env.MONITOR_DEV_MOCK === "1";
  const services = useMock
    ? mockServices()
    : await collectServices(monitorConfig.services);
  const body: ServicesResponse = {
    serverTime: new Date().toISOString(),
    platform: process.platform,
    services,
  };
  return NextResponse.json(body, {
    headers: { "Cache-Control": "no-store" },
  });
}
