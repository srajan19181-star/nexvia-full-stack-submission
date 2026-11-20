import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "flex min-h-11 w-full rounded-xl border border-[var(--glass-border)] bg-[var(--glass)] px-3.5 py-2 text-sm text-[var(--foreground)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] outline-none backdrop-blur-xl transition placeholder:text-[var(--muted-foreground)] focus:border-[var(--brand-cyan)] focus:ring-4 focus:ring-[color-mix(in_oklab,var(--brand-cyan)_13%,transparent)] disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
      {...props}
    />
  ),
);

Input.displayName = "Input";
