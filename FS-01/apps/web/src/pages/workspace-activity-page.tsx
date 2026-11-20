import { Activity } from "lucide-react";
import { useParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { LoadingSkeleton } from "@/components/ui/skeleton";
import { ActivityFeed } from "@/features/activity/activity-feed";
import { useActivity, useWorkspace } from "@/features/workspaces/queries";

export function WorkspaceActivityPage() {
  const { workspaceId = "" } = useParams();
  const workspace = useWorkspace(workspaceId);
  const activity = useActivity(workspaceId);

  if (workspace.isPending || activity.isPending) return <div className="mx-auto max-w-4xl space-y-5 p-8"><LoadingSkeleton className="h-12 w-1/2" /><LoadingSkeleton className="h-80 rounded-2xl" /></div>;
  if (workspace.isError || activity.isError) return <div className="grid min-h-[60vh] place-items-center"><p>Activity could not be loaded.</p></div>;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-8">
      <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-panel)] sm:p-8">
        <div className="flex items-center gap-4">
          <span className="grid size-12 place-items-center rounded-xl border border-[var(--border)] bg-[var(--brand-soft)] text-[var(--brand)]"><Activity className="size-5" /></span>
          <div><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--brand)]">Activity history</p><h1 className="mt-1 text-3xl font-semibold tracking-[-0.04em]">Workspace activity</h1><p className="mt-1 text-sm text-[var(--muted-foreground)]">An auditable timeline for {workspace.data.name}.</p></div>
        </div>
      </div>
      <Card className="mt-8 p-2"><ActivityFeed items={activity.data.items} compact /></Card>
    </div>
  );
}
