import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

export function Logo({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <Link
      to="/"
      aria-label="Orvyn home"
      className={cn("group inline-flex items-center gap-2.5 font-semibold tracking-[-0.045em] text-[var(--foreground)]", className)}
    >
      <span className="grid size-9 place-items-center rounded-xl border border-[var(--glass-border)] bg-[var(--surface-subtle)] shadow-[0_10px_28px_-18px_var(--glow-cyan)] transition duration-300 group-hover:border-[var(--glass-border-strong)]">
        <svg viewBox="0 0 32 32" className="size-5" aria-hidden="true">
          <circle cx="16" cy="16" r="9.5" fill="none" stroke="var(--brand)" strokeWidth="3" />
          <circle cx="23.5" cy="8.5" r="2.5" fill="var(--brand-strong)" />
          <path d="M10.5 20.5 21.5 11" fill="none" stroke="var(--foreground)" strokeLinecap="round" strokeWidth="2" opacity=".72" />
        </svg>
      </span>
      {!compact && <span className="text-xl lowercase">orvyn<span className="text-[var(--brand)]">.</span></span>}
    </Link>
  );
}
