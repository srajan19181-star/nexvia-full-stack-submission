import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Logo } from "./logo";
import { ThemeToggle } from "./theme-toggle";

export function MarketingHeader() {
  return (
    <header className="fixed inset-x-0 top-3 z-40 px-3 sm:top-4 sm:px-5">
      <div className="glass-panel mx-auto flex h-16 max-w-7xl items-center justify-between rounded-2xl border border-[var(--glass-border)] bg-[var(--glass)] px-4 shadow-[0_20px_60px_-38px_var(--glow-cyan)] backdrop-blur-2xl sm:px-5">
        <Logo />
        <nav className="hidden items-center gap-7 text-sm text-[var(--muted-foreground)] md:flex" aria-label="Main navigation">
          <a href="#product" className="transition hover:text-[var(--brand-cyan)]">Product</a>
          <a href="#workflow" className="transition hover:text-[var(--brand-cyan)]">How it works</a>
          <a href="#security" className="transition hover:text-[var(--brand-cyan)]">Security</a>
        </nav>
        <div className="flex items-center gap-1.5">
          <ThemeToggle />
          <Button variant="ghost" size="sm" asChild className="hidden sm:inline-flex">
            <Link to="/login">Sign in</Link>
          </Button>
          <Button size="sm" asChild>
            <Link to="/register">Start free</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
