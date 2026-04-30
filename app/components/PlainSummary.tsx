import type { Severity } from "@/lib/types";

const tone: Record<Severity, string> = {
  ok: "bg-emerald-100 text-emerald-900 ring-emerald-400/50 dark:bg-emerald-950/60 dark:text-emerald-200",
  warn: "bg-amber-100 text-amber-900 ring-amber-400/60 dark:bg-amber-950/60 dark:text-amber-200",
  critical:
    "bg-rose-100 text-rose-900 ring-rose-400/70 dark:bg-rose-950/60 dark:text-rose-200",
  unknown:
    "bg-zinc-100 text-zinc-900 ring-zinc-400/50 dark:bg-zinc-900 dark:text-zinc-200",
};

const icon: Record<Severity, string> = {
  ok: "✓",
  warn: "!",
  critical: "✗",
  unknown: "?",
};

const iconBg: Record<Severity, string> = {
  ok: "bg-emerald-500",
  warn: "bg-amber-500",
  critical: "bg-rose-500",
  unknown: "bg-zinc-400",
};

export function PlainSummary({
  severity,
  message,
}: {
  severity: Severity;
  message: string;
}) {
  return (
    <div
      className={`rounded-xl ring-1 px-5 py-4 flex items-start gap-3 ${tone[severity]}`}
      role="status"
      aria-live="polite"
    >
      <span
        className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-white text-base font-bold shrink-0 ${iconBg[severity]}`}
        aria-hidden="true"
      >
        {icon[severity]}
      </span>
      <div className="min-w-0">
        <div className="text-sm font-semibold mb-1">総合判定</div>
        <div className="text-base leading-relaxed">{message}</div>
      </div>
    </div>
  );
}
