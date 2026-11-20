import { Activity, Bell, FileText } from "lucide-react";
import { Link } from "react-router-dom";
import { LoadingSkeleton } from "@/components/ui/skeleton";
import { useDashboard } from "@/features/workspaces/queries";

export function NotificationMenu() {
  const dashboard = useDashboard();

  return (
    <details className="group relative z-[60]">
      <summary className="grid size-10 cursor-pointer list-none place-items-center rounded-lg text-[var(--muted-foreground)] transition hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]" aria-label="Open recent activity">
        <Bell className="size-4.5" />
      </summary>
      <div data-testid="notification-panel" className="absolute right-0 top-[calc(100%+8px)] z-[70] w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl">
        <div className="border-b border-[var(--border)] px-4 py-3"><p className="text-sm font-semibold">Recent activity</p><p className="mt-0.5 text-xs text-[var(--muted-foreground)]">Updates across your workspaces</p></div>
        {dashboard.isPending ? <div className="space-y-2 p-4"><LoadingSkeleton className="h-12" /><LoadingSkeleton className="h-12" /></div> : dashboard.isError ? <p className="p-5 text-sm text-[var(--muted-foreground)]">Activity is temporarily unavailable.</p> : dashboard.data.activity.length ? (
          <div className="max-h-80 overflow-y-auto p-2">
            {dashboard.data.activity.slice(0, 6).map((item) => {
              const workspaceId = item.workspace?.id;
              const destination = workspaceId && item.page ? `/workspace/${workspaceId}/page/${item.page.id}` : workspaceId ? `/workspace/${workspaceId}/activity` : "/dashboard";
              return <Link key={item.id} to={destination} className="flex gap-3 rounded-lg px-3 py-3 transition hover:bg-[var(--surface-hover)]"><span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[var(--brand-soft)] text-[var(--brand)]">{item.page ? <FileText className="size-3.5" /> : <Activity className="size-3.5" />}</span><span className="min-w-0"><span className="block truncate text-sm font-medium">{item.page?.title ?? item.workspace?.name ?? "Workspace update"}</span><span className="mt-0.5 block text-xs text-[var(--muted-foreground)]">{item.actor?.name ?? "System"} · {item.action.replaceAll("_", " ").toLowerCase()}</span></span></Link>;
            })}
          </div>
        ) : <p className="p-5 text-sm text-[var(--muted-foreground)]">No recent activity yet.</p>}
      </div>
    </details>
  );
}
