import "server-only";
import { NextResponse } from "next/server";
import { collectLogs } from "@/lib/collectors/logs";
import { mockLogs } from "@/lib/collectors/mock";
import type { LogsResponse } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const useMock = process.env.MONITOR_DEV_MOCK === "1";
  const logs = useMock ? mockLogs() : await collectLogs();
  const body: LogsResponse = {
    serverTime: new Date().toISOString(),
    platform: process.platform,
    logs,
  };
  return NextResponse.json(body, {
    headers: { "Cache-Control": "no-store" },
  });
}
