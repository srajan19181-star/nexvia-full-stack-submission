import { Mail, ShieldCheck, UserMinus, UserPlus, UsersRound } from "lucide-react";
import { useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { LoadingSkeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/features/auth/auth-provider";
import { InviteMemberDialog } from "@/features/workspaces/components/invite-member-dialog";
import { useInvitations, useMembers, useRemoveMember, useRevokeInvitation, useUpdateMember, useWorkspace } from "@/features/workspaces/queries";
import type { WorkspaceMemberItem } from "@/features/workspaces/types";
import { initials } from "@/lib/utils";

const selectClass = "min-h-9 rounded-lg border border-[var(--glass-border)] bg-[var(--glass)] px-2 text-xs outline-none transition focus:border-[var(--brand-cyan)]";

export function WorkspaceMembersPage() {
  const { workspaceId = "" } = useParams();
  const { user } = useAuth();
  const workspace = useWorkspace(workspaceId);
  const members = useMembers(workspaceId);
  const isAdmin = workspace.data?.workspaceRole === "OWNER" || workspace.data?.workspaceRole === "ADMIN";
  const invitations = useInvitations(workspaceId, isAdmin);
  const updateMember = useUpdateMember(workspaceId);
  const removeMember = useRemoveMember(workspaceId);
  const revokeInvitation = useRevokeInvitation(workspaceId);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<WorkspaceMemberItem | null>(null);

  if (workspace.isPending || members.isPending) return <div className="mx-auto max-w-5xl space-y-5 p-8"><LoadingSkeleton className="h-12 w-1/2" /><LoadingSkeleton className="h-80 rounded-2xl" /></div>;
  if (workspace.isError || members.isError) return <div className="grid min-h-[60vh] place-items-center text-center"><div><h1 className="text-2xl font-semibold">Members unavailable</h1><p className="mt-2 text-sm text-[var(--muted-foreground)]">Your access may have changed.</p></div></div>;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-8">
      <div className="relative overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-panel)] sm:p-8"><div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"><div><span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--brand)]"><UsersRound className="size-4" /> Sharing</span><h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em]">Members & access</h1><p className="mt-2 text-sm text-[var(--muted-foreground)]">Manage who can view, comment on, or edit {workspace.data.name}.</p></div>{isAdmin && <Button onClick={() => setInviteOpen(true)}><UserPlus className="size-4" /> Invite member</Button>}</div></div>
      <Card className="mt-8 overflow-hidden"><div className="border-b border-[var(--glass-border)] px-5 py-4"><h2 className="font-semibold">Workspace members</h2><p className="mt-1 text-xs text-[var(--muted-foreground)]">{members.data.length} active {members.data.length === 1 ? "member" : "members"}</p></div><div className="divide-y divide-[var(--glass-border)]">{members.data.map((member) => {
        const owner = member.workspaceRole === "OWNER";
        const canManage = isAdmin && !owner && !(workspace.data.workspaceRole === "ADMIN" && member.workspaceRole === "ADMIN");
        return <div key={member.id} className="flex flex-col gap-4 px-5 py-4 transition hover:bg-[var(--glass-hover)] sm:flex-row sm:items-center"><span className="grid size-10 shrink-0 place-items-center rounded-xl border border-[var(--glass-border)] bg-[var(--brand-soft)] text-xs font-semibold text-[var(--brand-cyan)]">{initials(member.user.name)}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{member.user.name}{member.user.id === user?.id && <span className="ml-2 text-xs font-normal text-[var(--muted-foreground)]">You</span>}</p><p className="truncate text-xs text-[var(--muted-foreground)]">{member.user.email}</p></div><div className="flex flex-wrap items-center gap-2"><select className={selectClass} value={member.workspaceRole} disabled={!canManage} onChange={(event) => void updateMember.mutateAsync({ memberId: member.id, input: { workspaceRole: event.target.value as "ADMIN" | "MEMBER" } }).catch(() => toast.error("Could not update role"))}><option value="OWNER" disabled>Owner</option><option value="ADMIN">Admin</option><option value="MEMBER">Member</option></select><select className={selectClass} value={member.contentRole} disabled={!canManage} onChange={(event) => void updateMember.mutateAsync({ memberId: member.id, input: { contentRole: event.target.value as "EDITOR" | "COMMENTER" | "VIEWER" } }).catch(() => toast.error("Could not update access"))}><option value="EDITOR">Editor</option><option value="COMMENTER">Commenter</option><option value="VIEWER">Viewer</option></select>{canManage && <Button variant="ghost" size="icon" onClick={() => setRemoveTarget(member)} aria-label={`Remove ${member.user.name}`}><UserMinus className="size-4 text-[var(--danger)]" /></Button>}</div></div>;
      })}</div></Card>

      {isAdmin && <Card className="mt-6 overflow-hidden"><div className="border-b border-[var(--glass-border)] px-5 py-4"><h2 className="font-semibold">Pending invitations</h2><p className="mt-1 text-xs text-[var(--muted-foreground)]">Links expire automatically after seven days.</p></div>{invitations.isPending ? <div className="p-5"><LoadingSkeleton className="h-14" /></div> : invitations.data?.filter((item) => item.status === "PENDING").length ? <div className="divide-y divide-[var(--glass-border)]">{invitations.data.filter((item) => item.status === "PENDING").map((invitation) => <div key={invitation.id} className="flex items-center gap-3 px-5 py-4 transition hover:bg-[var(--glass-hover)]"><span className="grid size-10 place-items-center rounded-xl border border-[var(--glass-border)] bg-[var(--glass)]"><Mail className="size-4 text-[var(--brand)]" /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{invitation.email}</p><p className="text-xs capitalize text-[var(--muted-foreground)]">{invitation.workspaceRole.toLowerCase()} · {invitation.contentRole.toLowerCase()} · expires {new Date(invitation.expiresAt).toLocaleDateString()}</p></div><Button variant="ghost" size="sm" onClick={() => void revokeInvitation.mutateAsync(invitation.id).then(() => toast.success("Invitation revoked")).catch(() => toast.error("Could not revoke invitation"))}>Revoke</Button></div>)}</div> : <div className="p-8 text-center text-sm text-[var(--muted-foreground)]"><ShieldCheck className="mx-auto mb-3 size-5 text-[var(--success)]" />No pending invitations</div>}</Card>}

      <InviteMemberDialog workspaceId={workspaceId} open={inviteOpen} onOpenChange={setInviteOpen} />
      <ConfirmDialog open={Boolean(removeTarget)} onOpenChange={(open) => !open && setRemoveTarget(null)} title={`Remove ${removeTarget?.user.name ?? "member"}?`} description="They will immediately lose access to every page in this workspace." confirmLabel="Remove member" destructive busy={removeMember.isPending} onConfirm={() => { if (!removeTarget) return; void removeMember.mutateAsync(removeTarget.id).then(() => { toast.success("Member removed"); setRemoveTarget(null); }).catch(() => toast.error("Could not remove member")); }} />
    </div>
  );
}
