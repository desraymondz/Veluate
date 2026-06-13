"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";

type Props = {
  title: string;
  label?: string;
  order?: number;
  summary?: string;
  meta?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
};

export function CollapsibleSection({
  title,
  label,
  order,
  summary,
  meta,
  defaultOpen = false,
  children,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="overflow-hidden border border-border bg-card">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className={cn(
          "group flex w-full items-start justify-between gap-4 px-6 py-5 text-left transition-colors duration-150",
          "hover:bg-foreground/[0.06] active:bg-foreground/[0.09]",
          open && "bg-foreground/[0.03]"
        )}
      >
        <div className="min-w-0 flex-1">
          {label && <p className="veluate-label">{label}</p>}
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            {order != null && (
              <span className="font-mono text-xs tabular-nums text-muted-foreground/70 transition-colors group-hover:text-muted-foreground">
                {String(order).padStart(2, "0")}
              </span>
            )}
            <h2 className="font-display text-2xl tracking-wide transition-colors group-hover:text-foreground">
              {title}
            </h2>
            {meta}
          </div>
          {!open && summary && (
            <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted-foreground transition-colors group-hover:text-foreground/70">
              {summary}
            </p>
          )}
        </div>
        <ChevronDown
          className={cn(
            "mt-1 size-5 shrink-0 text-muted-foreground transition-all duration-200 group-hover:text-foreground",
            open && "rotate-180 text-foreground"
          )}
          aria-hidden
        />
      </button>

      {open && (
        <div className="border-t border-border bg-background px-6 py-5">
          {children}
        </div>
      )}
    </div>
  );
}
