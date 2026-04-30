"use client";
import type { Severity } from "@/lib/types";
import type { MuteCategory } from "@/app/hooks/useMuteList";

const sevStyle: Record<Severity, { dot: string; label: string; icon: string; row: string }> = {
  ok: {
    dot: "bg-emerald-500",
    label: "正常",
    icon: "✓",
    row: "",
  },
  warn: {
    dot: "bg-amber-500",
    label: "注意",
    icon: "!",
    row: "bg-amber-50/60 dark:bg-amber-950/20",
  },
  critical: {
    dot: "bg-rose-500",
    label: "異常",
    icon: "✗",
    row: "bg-rose-50/70 dark:bg-rose-950/20",
  },
  unknown: {
    dot: "bg-zinc-400",
    label: "未取得",
    icon: "?",
    row: "",
  },
};

export interface StatusRow {
  id: string;
  title: string;
  severity: Severity;
  primary: string;
  secondary?: string;
  hint?: string;
  muted?: boolean;
  muteCategory?: MuteCategory;
  muteKey?: string;
  muteOrigin?: "config" | "user";
}

export function StatusTable({
  title,
  rows,
  emptyMessage,
  onToggleMute,
}: {
  title: string;
  rows: StatusRow[];
  emptyMessage?: string;
  onToggleMute?: (cat: MuteCategory, key: string) => void;
}) {
  return (
    <section className="space-y-2">
      <h2 className="text-xs font-semibold tracking-widest text-zinc-500 dark:text-zinc-400 uppercase">
        {title}
      </h2>
      <div className="overflow-x-auto rounded-lg ring-1 ring-zinc-200 dark:ring-zinc-800">
        <table className="w-full text-sm border-collapse">
          <thead className="bg-zinc-50 dark:bg-zinc-900/60 text-zinc-500 dark:text-zinc-400">
            <tr className="text-left">
              <th className="px-3 py-2 font-medium whitespace-nowrap w-[96px]">状態</th>
              <th className="px-3 py-2 font-medium whitespace-nowrap">項目</th>
              <th className="px-3 py-2 font-medium whitespace-nowrap">値</th>
              <th className="px-3 py-2 font-medium whitespace-nowrap">補足</th>
              <th className="px-3 py-2 font-medium whitespace-nowrap">ヒント</th>
              <th className="px-3 py-2 font-medium whitespace-nowrap w-[110px] text-right">
                操作
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 bg-white dark:bg-zinc-950">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-3 text-center text-zinc-500 dark:text-zinc-400">
                  {emptyMessage ?? "読み込み中…"}
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const s = sevStyle[r.severity];
                const dim = r.muted ? "opacity-60" : "";
                const rowBg = r.muted ? "" : s.row;
                const canToggle = !!(r.muteCategory && r.muteKey && onToggleMute);
                return (
                  <tr key={r.id} className={`align-top ${rowBg} ${dim}`}>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {r.muted ? (
                        <span className="inline-flex items-center gap-2">
                          <span
                            className="inline-flex items-center justify-center px-1.5 h-5 rounded-full bg-zinc-300 dark:bg-zinc-700 text-[10px] font-semibold text-zinc-700 dark:text-zinc-200"
                            role="img"
                            aria-label="監視除外"
                          >
                            除外
                          </span>
                          <span className="text-xs text-zinc-500 dark:text-zinc-400">対象外</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-2">
                          <span
                            className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-white text-[11px] font-bold ${s.dot}`}
                            role="img"
                            aria-label={s.label}
                          >
                            {s.icon}
                          </span>
                          <span className="text-xs text-zinc-600 dark:text-zinc-300">{s.label}</span>
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 font-medium text-zinc-900 dark:text-zinc-50 whitespace-nowrap">
                      {r.title}
                    </td>
                    <td className="px-3 py-2 tabular-nums text-zinc-900 dark:text-zinc-50 whitespace-nowrap">
                      {r.primary}
                    </td>
                    <td className="px-3 py-2 text-zinc-600 dark:text-zinc-300">
                      {r.secondary ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-zinc-500 dark:text-zinc-400 leading-relaxed">
                      {r.hint ?? "—"}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-right">
                      {!canToggle ? (
                        <span className="text-xs text-zinc-400 dark:text-zinc-600">—</span>
                      ) : r.muteOrigin === "config" ? (
                        <span
                          className="text-xs text-zinc-400 dark:text-zinc-500"
                          title="config/monitor.ts で除外設定済み"
                        >
                          config 設定
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onToggleMute?.(r.muteCategory!, r.muteKey!)}
                          className={`text-xs px-2 py-1 rounded ring-1 transition-colors ${
                            r.muteOrigin === "user"
                              ? "ring-emerald-400/50 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                              : "ring-zinc-300 dark:ring-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                          }`}
                        >
                          {r.muteOrigin === "user" ? "解除" : "ミュート"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
