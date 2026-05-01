import "server-only";
import { targets } from "@/config/monitor";
import type { HostTarget, Target, TargetRef } from "@/lib/types";

export type TargetResolution =
  | { ok: true; target: HostTarget }
  | { ok: false; status: number; message: string };

export function listTargets(): Target[] {
  return targets;
}

export function getDefaultTarget(): Target {
  if (targets.length === 0) {
    throw new Error("config/monitor.ts に targets が 1 件も定義されていません");
  }
  return targets[0];
}

export function getTarget(id: string | null | undefined): Target | null {
  if (!id) return getDefaultTarget();
  return targets.find((t) => t.id === id) ?? null;
}

export function targetRef(t: Target): TargetRef {
  return { id: t.id, name: t.name, kind: t.kind };
}

export class TargetNotSupportedError extends Error {
  constructor(public readonly kind: string) {
    super(`target kind "${kind}" は現フェーズでは未対応です`);
    this.name = "TargetNotSupportedError";
  }
}

// Phase 1: host のみ対応。他 kind は 501 を返す。
export function resolveHostTarget(searchParams: URLSearchParams): TargetResolution {
  const id = searchParams.get("target");
  const t = getTarget(id);
  if (!t) {
    return { ok: false, status: 404, message: `unknown target: ${id}` };
  }
  if (t.kind !== "host") {
    return {
      ok: false,
      status: 501,
      message: `target kind "${t.kind}" は現フェーズでは未対応`,
    };
  }
  return { ok: true, target: t };
}
