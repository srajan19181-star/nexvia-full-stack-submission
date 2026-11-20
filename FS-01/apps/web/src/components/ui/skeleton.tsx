import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function LoadingSkeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn("spatial-skeleton rounded-lg bg-[var(--surface-hover)]", className)}
      {...props}
    />
  );
}
