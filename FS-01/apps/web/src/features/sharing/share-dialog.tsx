import type { ContentRoleValue } from "@nexvia/shared";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { LoadingSkeleton } from "@/components/ui/skeleton";
import { initials } from "@/lib/utils";
import { usePagePermissions, useRemovePagePermission, useSetPagePermission } from "./queries";

const selectClass = "min-h-9 rounded-lg border border-[var(--glass-border)] bg-[var(--glass)] px-2 text-xs outline-none focus:border-[var(--brand-cyan)] disabled:opacity-60";

function effectiveLabel(permissions: { edit: boolean; comment: boolean }) {
  return permissions.edit ? "Can edit" : permissions.comment ? "Can comment" : "Can view";
}

export function ShareDialog({ workspaceId, pageId, pageTitle, open, onOpenChange, canManage }: { workspaceId: string; pageId: string; pageTitle: string; open: boolean; onOpenChange: (open: boolean) => void; canManage: boolean }) {
  const permissions = usePagePermissions(workspaceId, pageId, open);
  const setPermission = useSetPagePermission(workspaceId, pageId);
  const removePermission = useRemovePagePermission(workspaceId, pageId);

  const update = async (memberId: string, role: string) => {
    try {
      if (role === "INHERITED") await removePermission.mutateAsync(memberId);
      else await setPermission.mutateAsync({ memberId, input: { role: role as ContentRoleValue } });
      toast.success("Page access updated");
    } catch {
      toast.error("Could not update page access");
    }
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={`Share “${pageTitle}”`} description="Workspace access applies by default. Page overrides take effect immediately in REST and live collaboration.">
      <div className="flex items-center justify-between rounded-xl border border-[var(--glass-border)] bg-[var(--brand-soft)] p-3"><div><p className="text-sm font-medium">Private workspace page</p><p className="mt-0.5 text-xs text-[var(--muted-foreground)]">No public edit link is enabled.</p></div>{canManage && <Button variant="secondary" size="sm" asChild><Link to={`/workspace/${workspaceId}/members`}>Invite people</Link></Button>}</div>
      <div className="mt-5"><div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold">People with access</h3><span className="text-xs text-[var(--muted-foreground)]">{permissions.data?.length ?? 0} members</span></div>
        {permissions.isPending && <div className="space-y-2"><LoadingSkeleton className="h-14" /><LoadingSkeleton className="h-14" /></div>}
        {permissions.isError && <div className="rounded-xl border border-[var(--border)] p-5 text-center text-sm"><p>Sharing settings could not load.</p><Button size="sm" variant="secondary" className="mt-3" onClick={() => void permissions.refetch()}>Try again</Button></div>}
        <div className="max-h-72 divide-y divide-[var(--border)] overflow-y-auto">{permissions.data?.map((member) => {
          const administrator = member.workspaceRole === "OWNER" || member.workspaceRole === "ADMIN";
          return <div key={member.id} className="flex items-center gap-3 py-3"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[var(--brand-soft)] text-[10px] font-semibold text-[var(--brand)]">{initials(member.user.name)}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{member.user.name}</p><p className="truncate text-[11px] text-[var(--muted-foreground)]">{administrator ? `${member.workspaceRole.toLowerCase()} · full access` : member.pageRole ? `Page override · ${effectiveLabel(member.effectivePermissions)}` : `Inherited · ${effectiveLabel(member.effectivePermissions)}`}</p></div><select aria-label={`Access for ${member.user.name}`} className={selectClass} value={administrator ? "ADMINISTRATOR" : member.pageRole ?? "INHERITED"} disabled={!canManage || administrator || setPermission.isPending || removePermission.isPending} onChange={(event) => void update(member.id, event.target.value)}><option value="ADMINISTRATOR" disabled>Full access</option><option value="INHERITED">Inherited ({member.contentRole.toLowerCase()})</option><option value="EDITOR">Can edit</option><option value="COMMENTER">Can comment</option><option value="VIEWER">Can view</option></select></div>;
        })}</div>
      </div>
    </Modal>
  );
}
