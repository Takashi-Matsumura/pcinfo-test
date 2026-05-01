"use client";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { OverviewGrade, Severity, TargetKind } from "@/lib/types";

export interface TargetNodeData extends Record<string, unknown> {
  label: string;
  kind: TargetKind;
  severity: Severity;
  grade: OverviewGrade;
  gradeLabel: string;
  score: number;
  primary: string | null;
  error?: string;
}

const gradeStyle: Record<
  OverviewGrade,
  { ring: string; bg: string; bar: string; text: string }
> = {
  excellent: {
    ring: "ring-emerald-400 dark:ring-emerald-500",
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
    bar: "bg-emerald-500",
    text: "text-emerald-700 dark:text-emerald-300",
  },
  good: {
    ring: "ring-emerald-300 dark:ring-emerald-700",
    bg: "bg-white dark:bg-zinc-900",
    bar: "bg-emerald-400",
    text: "text-emerald-700 dark:text-emerald-300",
  },
  caution: {
    ring: "ring-amber-400 dark:ring-amber-500",
    bg: "bg-amber-50 dark:bg-amber-950/30",
    bar: "bg-amber-500",
    text: "text-amber-700 dark:text-amber-300",
  },
  critical: {
    ring: "ring-rose-500 dark:ring-rose-400",
    bg: "bg-rose-50 dark:bg-rose-950/30",
    bar: "bg-rose-500",
    text: "text-rose-700 dark:text-rose-300",
  },
};

const kindLabel: Record<TargetKind, string> = {
  host: "ホスト",
  docker: "コンテナ",
  service: "サービス",
};

export function TargetNode({ data, selected }: NodeProps) {
  const d = data as TargetNodeData;
  const g = gradeStyle[d.grade];
  const score = Math.max(0, Math.min(100, d.score));
  return (
    <div
      className={`min-w-[200px] rounded-lg ring-1 ${g.ring} ${g.bg} ${
        selected ? "shadow-lg" : "shadow-sm"
      } transition-shadow`}
    >
      <Handle
        type="target"
        position={Position.Left}
        isConnectable={false}
        className="!opacity-0 !pointer-events-none"
      />
      <Handle
        type="source"
        position={Position.Right}
        isConnectable={false}
        className="!opacity-0 !pointer-events-none"
      />
      <div className="px-3 py-2 space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 truncate">
            {d.label}
          </span>
          <span className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500 shrink-0">
            {kindLabel[d.kind]}
          </span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className={`text-2xl font-bold tabular-nums ${g.text}`}>
            {score}
          </span>
          <span className={`text-xs font-medium ${g.text}`}>{d.gradeLabel}</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
          <div
            className={`h-full ${g.bar}`}
            style={{ width: `${score}%` }}
          />
        </div>
        {d.primary ? (
          <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
            主因: {d.primary}
          </div>
        ) : null}
        {d.error ? (
          <div className="text-[11px] text-rose-600 dark:text-rose-400 truncate">
            {d.error}
          </div>
        ) : null}
      </div>
    </div>
  );
}
