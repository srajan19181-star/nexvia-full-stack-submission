import { Activity, FilePlus2, History, MessageSquareText, UserPlus, UsersRound } from "lucide-react";
import { initials } from "@/lib/utils";
import type { ActivityItem } from "@/features/workspaces/types";

const labels: Record<string, string> = {
  "workspace.created": "created the workspace",
  "workspace.renamed": "renamed the workspace",
  "member.invited": "invited a collaborator",
  "invitation.accepted": "joined the workspace",
  "invitation.rejected": "declined an invitation",
  "invitation.revoked": "revoked an invitation",
  "member.permission_changed": "updated member permissions",
  "member.removed": "removed a member",
  "page.created": "created a page",
  "page.renamed": "renamed a page",
  "page.moved": "moved a page",
  "page.deleted": "moved a page to trash",
  "page.restored": "restored a page",
};

function iconFor(action: string) {
  if (action.startsWith("member") || action.startsWith("invitation")) return action === "member.invited" ? UserPlus : UsersRound;
  if (action.startsWith("page")) return action === "page.created" ? FilePlus2 : History;
  if (action.startsWith("comment")) return MessageSquareText;
  return Activity;
}

function relativeTime(value: string): string {
  const elapsed = Date.now() - new Date(value).getTime();
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days < 7 ? `${days}d ago` : new Date(value).toLocaleDateString();
}

export function ActivityFeed({ items, compact = false }: { items: ActivityItem[]; compact?: boolean }) {
  if (items.length === 0) {
    return <div className="rounded-2xl border border-dashed border-[var(--glass-border-strong)] bg-[var(--glass)] p-8 text-center text-sm text-[var(--muted-foreground)]">No activity yet. Changes will appear here.</div>;
  }

  return (
    <div className="space-y-1">
      {items.map((item) => {
        const Icon = iconFor(item.action);
        return (
          <div key={item.id} className="flex gap-3 rounded-xl border border-transparent p-3 transition hover:border-[var(--glass-border)] hover:bg-[var(--glass-hover)]">
            {item.actor ? (
              <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-[var(--glass-border)] bg-[var(--brand-soft)] text-xs font-semibold text-[var(--brand-cyan)]">{initials(item.actor.name)}</span>
            ) : (
              <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-[var(--glass-border)] bg-[var(--glass)] text-[var(--brand)]"><Icon className="size-4" /></span>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm leading-5"><span className="font-medium">{item.actor?.name ?? "System"}</span> <span className="text-[var(--muted-foreground)]">{labels[item.action] ?? item.action}</span>{item.page && <> <span className="font-medium">{item.page.icon} {item.page.title}</span></>}</p>
              {!compact && item.workspace && <p className="mt-1 text-xs text-[var(--muted-foreground)]">{item.workspace.name}</p>}
            </div>
            <time className="shrink-0 text-[10px] text-[var(--muted-foreground)]" dateTime={item.createdAt}>{relativeTime(item.createdAt)}</time>
          </div>
        );
      })}
    </div>
  );
}
