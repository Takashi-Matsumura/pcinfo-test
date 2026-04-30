import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { monitorConfig } from "@/config/monitor";
import { collectServices } from "@/lib/collectors/services";
import { mockServices } from "@/lib/collectors/mock";
import { resolveHostTarget, targetRef } from "@/lib/targets";
import type { ServicesResponse } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const r = resolveHostTarget(url.searchParams);
  if (!r.ok) {
    return NextResponse.json({ error: r.message }, { status: r.status });
  }

  const useMock = process.env.MONITOR_DEV_MOCK === "1";
  const services = useMock
    ? mockServices()
    : await collectServices(monitorConfig.services);
  const body: ServicesResponse = {
    serverTime: new Date().toISOString(),
    platform: process.platform,
    target: targetRef(r.target),
    services,
  };
  return NextResponse.json(body, {
    headers: { "Cache-Control": "no-store" },
  });
}
