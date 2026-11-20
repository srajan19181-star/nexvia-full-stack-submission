import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "glass-panel rounded-2xl border border-[var(--glass-border)] bg-[var(--glass)] shadow-[var(--shadow-panel)] backdrop-blur-2xl",
        className,
      )}
      {...props}
    />
  );
}
