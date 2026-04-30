import type { Severity } from "@/lib/types";

const sevStyle: Record<
  Severity,
  { card: string; badge: string; icon: string; label: string }
> = {
  ok: {
    card: "bg-emerald-50 dark:bg-emerald-950/40 ring-emerald-500/40",
    badge: "bg-emerald-500",
    icon: "✓",
    label: "正常",
  },
  warn: {
    card: "bg-amber-50 dark:bg-amber-950/40 ring-amber-500/50",
    badge: "bg-amber-500",
    icon: "!",
    label: "注意",
  },
  critical: {
    card: "bg-rose-50 dark:bg-rose-950/40 ring-rose-500/60",
    badge: "bg-rose-500",
    icon: "✗",
    label: "異常",
  },
  unknown: {
    card: "bg-zinc-100 dark:bg-zinc-900/60 ring-zinc-400/40",
    badge: "bg-zinc-400",
    icon: "?",
    label: "未取得",
  },
};

export function StatusCard({
  title,
  severity,
  primary,
  secondary,
  hint,
}: {
  title: string;
  severity: Severity;
  primary: string;
  secondary?: string;
  hint?: string;
}) {
  const s = sevStyle[severity];
  return (
    <div className={`rounded-xl ring-1 ${s.card} p-4 flex flex-col gap-2`}>
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-medium text-zinc-700 dark:text-zinc-200 truncate">
          {title}
        </div>
        <span
          className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-white text-xs font-bold shrink-0 ${s.badge}`}
          aria-label={s.label}
          role="img"
        >
          {s.icon}
        </span>
      </div>
      <div className="text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
        {primary}
      </div>
      {secondary ? (
        <div className="text-xs text-zinc-500 dark:text-zinc-400">{secondary}</div>
      ) : null}
      {hint ? (
        <div className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed border-t border-zinc-200/60 dark:border-zinc-800/60 pt-2 mt-1">
          {hint}
        </div>
      ) : null}
    </div>
  );
}
