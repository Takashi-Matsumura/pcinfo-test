"use client";

export type ViewMode = "topology" | "detail";

export function ViewToggle({
  value,
  onChange,
}: {
  value: ViewMode;
  onChange: (v: ViewMode) => void;
}) {
  const item = (mode: ViewMode, label: string) => {
    const active = value === mode;
    return (
      <button
        key={mode}
        type="button"
        onClick={() => onChange(mode)}
        aria-pressed={active}
        className={`px-3 py-1 text-xs font-medium transition-colors ${
          active
            ? "bg-emerald-600 text-white"
            : "text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
        }`}
      >
        {label}
      </button>
    );
  };
  return (
    <div
      role="group"
      aria-label="表示切替"
      className="inline-flex rounded-md ring-1 ring-zinc-200 dark:ring-zinc-700 overflow-hidden bg-white dark:bg-zinc-900"
    >
      {item("topology", "概観")}
      {item("detail", "詳細")}
    </div>
  );
}
