import { CheckIcon, CircleIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export default function ToolToggleButton({
  label,
  selected,
  onClick,
  className,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "group flex min-w-[11rem] items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
        selected
          ? "border-foreground/15 bg-secondary/75 text-foreground shadow-sm"
          : "border-dashed border-border bg-background text-foreground hover:border-foreground/20 hover:bg-muted/35",
        className
      )}
    >
      <span
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors",
          selected
            ? "border-emerald-600 bg-emerald-600 text-white dark:border-emerald-500 dark:bg-emerald-500"
            : "border-border bg-muted text-muted-foreground"
        )}
      >
        {selected ? <CheckIcon className="size-3.5" /> : <CircleIcon className="size-3.5" />}
      </span>

      <span className="min-w-0">
        <span className="block text-sm font-medium text-foreground">{label}</span>
        <span
          className={cn(
            "mt-0.5 block text-[11px] font-medium tracking-[0.08em] uppercase",
            selected ? "text-emerald-700 dark:text-emerald-300" : "text-muted-foreground"
          )}
        >
          {selected ? "Included" : "Off"}
        </span>
      </span>
    </button>
  );
}
