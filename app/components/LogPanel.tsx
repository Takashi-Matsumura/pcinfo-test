"use client";
import { useState } from "react";
import type { LogsResponse } from "@/lib/types";

export function LogPanel() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<LogsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/logs", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as LogsResponse;
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <details
      className="rounded-xl ring-1 ring-zinc-300/60 dark:ring-zinc-700/60 bg-white dark:bg-zinc-900/40"
      onToggle={(e) => {
        const isOpen = (e.currentTarget as HTMLDetailsElement).open;
        setOpen(isOpen);
        if (isOpen && !data && !loading) void fetchLogs();
      }}
    >
      <summary className="cursor-pointer select-none px-5 py-3 text-sm font-semibold text-zinc-800 dark:text-zinc-200 flex items-center justify-between">
        <span>直近のシステムログ（journal / dmesg）</span>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          {open ? "▲ 閉じる" : "▼ 開く"}
        </span>
      </summary>
      <div className="px-5 py-3 border-t border-zinc-200/60 dark:border-zinc-800/60 space-y-2">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void fetchLogs()}
            disabled={loading}
            className="text-xs px-3 py-1.5 rounded-md bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-300 dark:hover:bg-zinc-700 disabled:opacity-50"
          >
            {loading ? "取得中…" : "再取得"}
          </button>
          {data ? (
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              {new Date(data.serverTime).toLocaleTimeString("ja-JP")} 取得
            </span>
          ) : null}
        </div>
        {error ? <div className="text-sm text-rose-600">エラー: {error}</div> : null}
        {data && !data.logs.ok ? (
          <div className="text-sm text-zinc-500">
            ログ取得不可: {data.logs.error}
          </div>
        ) : null}
        {data && data.logs.ok ? (
          data.logs.value.length === 0 ? (
            <div className="text-sm text-zinc-500">直近のエラーログはありません。</div>
          ) : (
            <pre className="text-xs leading-relaxed font-mono whitespace-pre-wrap break-all bg-zinc-50 dark:bg-zinc-950 rounded-md p-3 max-h-80 overflow-auto">
              {data.logs.value
                .map((e) => `[${e.source === "journal" ? "JRN" : "KRN"}] ${e.line}`)
                .join("\n")}
            </pre>
          )
        ) : null}
      </div>
    </details>
  );
}
