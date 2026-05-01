import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { resolveTarget, targetRef } from "@/lib/targets";
import { runProbes } from "@/lib/probes";
import type { CollectorResult, ProbeResult, ProbesResponse } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const r = resolveTarget(url.searchParams);
  if (!r.ok) {
    return NextResponse.json({ error: r.message }, { status: r.status });
  }
  const target = r.target;
  const collectedAt = new Date().toISOString();

  let probes: CollectorResult<ProbeResult[]>;
  if (target.kind === "host") {
    probes = {
      ok: false,
      error: "host ターゲットには probe を設定できません",
      reason: "other",
      collectedAt,
    };
  } else {
    const list = target.kind === "service" ? target.probes : target.probes ?? [];
    if (list.length === 0) {
      probes = {
        ok: true,
        value: [],
        collectedAt,
      };
    } else {
      try {
        const results = await runProbes(list);
        probes = { ok: true, value: results, collectedAt };
      } catch (e) {
        probes = {
          ok: false,
          error: e instanceof Error ? e.message : String(e),
          reason: "other",
          collectedAt,
        };
      }
    }
  }

  const body: ProbesResponse = {
    serverTime: new Date().toISOString(),
    platform: process.platform,
    target: targetRef(target),
    probes,
  };
  return NextResponse.json(body, {
    headers: { "Cache-Control": "no-store" },
  });
}
