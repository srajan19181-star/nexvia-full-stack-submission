import { Check, ChevronDown, Plus } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { LoadingSkeleton } from "@/components/ui/skeleton";
import { useWorkspaces } from "../queries";
import { CreateWorkspaceDialog } from "./create-workspace-dialog";

export function WorkspaceSwitcher({ currentWorkspaceId }: { currentWorkspaceId?: string }) {
  const workspaces = useWorkspaces();
  const [createOpen, setCreateOpen] = useState(false);
  const current = workspaces.data?.find((workspace) => workspace.id === currentWorkspaceId) ?? workspaces.data?.[0];

  if (workspaces.isPending) {
    return <LoadingSkeleton className="mt-3 h-11 w-full rounded-xl" />;
  }

  return (
    <>
      <details className="group relative mt-3">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-xl border border-[var(--glass-border)] bg-[var(--glass)] px-3 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition hover:border-[var(--glass-border-strong)] hover:bg-[var(--glass-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]">
          <span className="grid size-7 place-items-center rounded-lg border border-[var(--glass-border-strong)] bg-[var(--brand-soft)] text-xs font-bold text-[var(--brand)]">{current?.name[0]?.toUpperCase() ?? "O"}</span>
          <span className="min-w-0 flex-1 truncate text-sm font-medium">{current?.name ?? "Choose a workspace"}</span>
          <ChevronDown className="size-4 text-[var(--muted-foreground)] transition group-open:rotate-180" />
        </summary>
        <div className="glass-panel absolute left-0 right-0 top-[calc(100%+6px)] z-50 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-strong)] p-1.5 shadow-2xl backdrop-blur-3xl">
          <p className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">Workspaces</p>
          {workspaces.data?.map((workspace) => (
            <Link key={workspace.id} to={`/workspace/${workspace.id}`} className="flex min-h-10 items-center gap-2 rounded-lg px-2.5 text-sm hover:bg-[var(--glass-hover)]">
              <span className="grid size-7 place-items-center rounded-md bg-[var(--surface-subtle)] text-xs font-semibold">{workspace.name[0]?.toUpperCase()}</span>
              <span className="min-w-0 flex-1 truncate">{workspace.name}</span>
              {workspace.id === currentWorkspaceId && <Check className="size-4 text-[var(--brand)]" />}
            </Link>
          ))}
          <div className="my-1 h-px bg-[var(--glass-border)]" />
          <button type="button" onClick={() => setCreateOpen(true)} className="flex min-h-10 w-full items-center gap-2 rounded-lg px-2.5 text-sm text-[var(--muted-foreground)] hover:bg-[var(--glass-hover)] hover:text-[var(--foreground)]">
            <Plus className="size-4" /> Create workspace
          </button>
        </div>
      </details>
      <CreateWorkspaceDialog open={createOpen} onOpenChange={setCreateOpen} />
    </>
  );
}
