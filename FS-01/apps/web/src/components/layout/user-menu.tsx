import { LogOut, Settings, UserRound } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/features/auth/auth-provider";
import { initials } from "@/lib/utils";

export function UserMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) {
    return null;
  }

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/login", { replace: true });
    } catch {
      toast.error("Could not sign out. Please try again.");
    }
  };

  return (
    <details className="group relative">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-xl px-2 text-left transition hover:bg-[var(--glass-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-[var(--glass-border)] bg-[var(--brand-soft)] text-xs font-semibold text-[var(--brand-cyan)] shadow-[0_8px_20px_-14px_var(--glow-cyan)]">
          {initials(user.name)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-[var(--foreground)]">{user.name}</span>
          <span className="block truncate text-xs text-[var(--muted-foreground)]">{user.email}</span>
        </span>
      </summary>
      <div className="glass-panel absolute bottom-[calc(100%+8px)] left-0 z-50 w-56 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-strong)] p-1.5 shadow-2xl backdrop-blur-3xl">
        <Link to="/settings" className="flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm hover:bg-[var(--glass-hover)]">
          <Settings className="size-4" /> Settings
        </Link>
        <Link to="/settings" className="flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm hover:bg-[var(--glass-hover)]">
          <UserRound className="size-4" /> Profile
        </Link>
        <div className="my-1 h-px bg-[var(--glass-border)]" />
        <button
          type="button"
          onClick={() => void handleLogout()}
          className="flex min-h-10 w-full items-center gap-2 rounded-lg px-3 text-sm text-[var(--danger)] hover:bg-[var(--glass-hover)]"
        >
          <LogOut className="size-4" /> Sign out
        </button>
      </div>
    </details>
  );
}
