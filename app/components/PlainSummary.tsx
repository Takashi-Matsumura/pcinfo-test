import type { CategoryFinding, Grade } from "@/lib/judge";
import type { Severity } from "@/lib/types";

const tone: Record<Severity, string> = {
  ok: "bg-emerald-100 text-emerald-900 ring-emerald-400/50 dark:bg-emerald-950/60 dark:text-emerald-200",
  warn: "bg-amber-100 text-amber-900 ring-amber-400/60 dark:bg-amber-950/60 dark:text-amber-200",
  critical:
    "bg-rose-100 text-rose-900 ring-rose-400/70 dark:bg-rose-950/60 dark:text-rose-200",
  unknown:
    "bg-zinc-100 text-zinc-900 ring-zinc-400/50 dark:bg-zinc-900 dark:text-zinc-200",
};

const scoreColor: Record<Grade, string> = {
  excellent: "text-emerald-700 dark:text-emerald-300",
  good: "text-emerald-700 dark:text-emerald-300",
  caution: "text-amber-700 dark:text-amber-300",
  critical: "text-rose-700 dark:text-rose-300",
};

const barColor: Record<Grade, string> = {
  excellent: "bg-emerald-500",
  good: "bg-emerald-500",
  caution: "bg-amber-500",
  critical: "bg-rose-500",
};

function gradeOfScore(s: number): Grade {
  if (s >= 90) return "excellent";
  if (s >= 70) return "good";
  if (s >= 40) return "caution";
  return "critical";
}

const CATEGORY_LABEL = {
  hardware: "ハードウェア",
  software: "ソフトウェア",
  network: "ネットワーク",
  security: "セキュリティ",
} as const;

export function PlainSummary({
  severity,
  message,
  score,
  gradeLabel,
  grade,
  findings,
  unavailable,
}: {
  severity: Severity;
  message: string;
  score: number;
  gradeLabel: string;
  grade: Grade;
  findings: CategoryFinding[];
  unavailable?: boolean;
}) {
  return (
    <div
      className={`rounded-xl ring-1 px-5 py-4 ${tone[severity]}`}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-5 flex-wrap">
        <div className="flex flex-col items-center min-w-[120px]">
          <div className="text-xs font-semibold tracking-widest uppercase opacity-70">
            総合判定
          </div>
          <div className="flex items-baseline gap-1 mt-1">
            <span
              className={`text-5xl font-bold tabular-nums ${unavailable ? "opacity-40" : scoreColor[grade]}`}
            >
              {unavailable ? "—" : score}
            </span>
            <span className="text-sm opacity-60">/ 100</span>
          </div>
          <div className="text-sm font-semibold mt-0.5">
            {unavailable ? "計測不能" : gradeLabel}
          </div>
        </div>

        <div className="flex-1 min-w-[260px]">
          <div className="text-sm leading-relaxed mb-3">{message}</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {findings.map((f) => {
              const g = gradeOfScore(f.score);
              return (
                <div
                  key={f.category}
                  className="rounded-md bg-white/40 dark:bg-black/20 px-2 py-1.5"
                >
                  <div className="text-[11px] opacity-70">{CATEGORY_LABEL[f.category]}</div>
                  <div className="flex items-baseline gap-1">
                    <span className={`text-lg font-semibold tabular-nums ${scoreColor[g]}`}>
                      {f.score}
                    </span>
                    {f.criticalCount + f.warnCount > 0 ? (
                      <span className="text-[11px] opacity-70">
                        {f.criticalCount > 0 ? `異 ${f.criticalCount}` : ""}
                        {f.criticalCount > 0 && f.warnCount > 0 ? " / " : ""}
                        {f.warnCount > 0 ? `注 ${f.warnCount}` : ""}
                      </span>
                    ) : (
                      <span className="text-[11px] opacity-50">—</span>
                    )}
                  </div>
                  <div className="h-1 mt-1 rounded bg-black/10 dark:bg-white/10 overflow-hidden">
                    <div
                      className={`h-full ${barColor[g]}`}
                      style={{ width: `${Math.max(2, f.score)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
