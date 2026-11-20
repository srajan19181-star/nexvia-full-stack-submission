import { ArchiveRestore, Settings, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { updateWorkspaceInputSchema } from "@nexvia/shared";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingSkeleton } from "@/components/ui/skeleton";
import { useDeleteWorkspace, usePages, useRestorePage, useUpdateWorkspace, useWorkspace } from "@/features/workspaces/queries";
import { ApiError } from "@/lib/api-client";

export function WorkspaceSettingsPage() {
  const { workspaceId = "" } = useParams();
  const workspace = useWorkspace(workspaceId);
  const pages = usePages(workspaceId, true);
  const updateWorkspace = useUpdateWorkspace(workspaceId);
  const deleteWorkspace = useDeleteWorkspace(workspaceId);
  const restorePage = useRestorePage(workspaceId);
  const navigate = useNavigate();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (workspace.isPending || pages.isPending) return <div className="mx-auto max-w-4xl space-y-5 p-8"><LoadingSkeleton className="h-12 w-1/2" /><LoadingSkeleton className="h-72 rounded-2xl" /></div>;
  if (workspace.isError || pages.isError) return <div className="grid min-h-[60vh] place-items-center"><p>Workspace settings are unavailable.</p></div>;

  const canManage = workspace.data.workspaceRole === "OWNER" || workspace.data.workspaceRole === "ADMIN";
  const isOwner = workspace.data.workspaceRole === "OWNER";
  const trashed = pages.data.filter((page) => page.deletedAt !== null);

  const rename = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError(null);
    const parsed = updateWorkspaceInputSchema.safeParse({ name: new FormData(event.currentTarget).get("name") });
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Enter a valid name"); return; }
    try { await updateWorkspace.mutateAsync(parsed.data); toast.success("Workspace renamed"); } catch (caught) { setError(caught instanceof ApiError ? caught.message : "Could not rename workspace"); }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-8">
      <div className="relative overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-panel)] sm:p-8"><div className="relative flex items-center gap-4"><span className="grid size-12 place-items-center rounded-xl border border-[var(--glass-border)] bg-[var(--brand-soft)] text-[var(--brand)]"><Settings className="size-5" /></span><div><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--brand)]">Workspace management</p><h1 className="mt-1 text-3xl font-semibold tracking-[-0.04em]">Workspace settings</h1><p className="mt-1 text-sm text-[var(--muted-foreground)]">Manage identity, trash, and workspace lifecycle.</p></div></div></div>
      <Card className="mt-8 p-6 sm:p-7"><h2 className="font-semibold">General</h2><p className="mt-1 text-xs text-[var(--muted-foreground)]">Visible to everyone with workspace access.</p><form onSubmit={(event) => void rename(event)} className="mt-6 space-y-4"><div className="space-y-2"><Label htmlFor="workspace-name">Workspace name</Label><Input id="workspace-name" name="name" defaultValue={workspace.data.name} disabled={!canManage} /></div>{error && <p className="text-sm text-[var(--danger)]">{error}</p>}{canManage && <Button type="submit" disabled={updateWorkspace.isPending}>{updateWorkspace.isPending ? "Saving…" : "Save changes"}</Button>}</form></Card>
      <Card className="mt-6 overflow-hidden"><div className="border-b border-[var(--glass-border)] px-6 py-5"><h2 className="font-semibold">Trash</h2><p className="mt-1 text-xs text-[var(--muted-foreground)]">Restore pages and any nested pages deleted in the same action.</p></div>{trashed.length ? <div className="divide-y divide-[var(--glass-border)]">{trashed.map((page) => <div key={page.id} className="flex items-center gap-3 px-6 py-4 transition hover:bg-[var(--glass-hover)]"><span className="text-lg">{page.icon ?? "📄"}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{page.title}</p><p className="text-xs text-[var(--muted-foreground)]">Deleted {new Date(page.deletedAt!).toLocaleDateString()}</p></div>{canManage && <Button variant="secondary" size="sm" onClick={() => void restorePage.mutateAsync(page.id).then(() => toast.success("Page restored")).catch(() => toast.error("Could not restore page"))}><ArchiveRestore className="size-3.5" /> Restore</Button>}</div>)}</div> : <div className="p-10 text-center text-sm text-[var(--muted-foreground)]"><Trash2 className="mx-auto mb-3 size-5" />Trash is empty</div>}</Card>
      {isOwner && <Card className="mt-6 border-[color-mix(in_oklab,var(--danger)_35%,var(--border))] p-6 sm:p-7"><h2 className="font-semibold text-[var(--danger)]">Danger zone</h2><p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">Deleting a workspace permanently removes its pages, comments, document states, snapshots, members, invitations, and activity.</p><Button variant="danger" className="mt-5" onClick={() => setDeleteOpen(true)}><Trash2 className="size-4" /> Delete workspace</Button></Card>}
      <ConfirmDialog open={deleteOpen} onOpenChange={setDeleteOpen} title={`Delete ${workspace.data.name}?`} description="This is a permanent cascade delete and cannot be undone." confirmLabel="Delete workspace" destructive busy={deleteWorkspace.isPending} onConfirm={() => { void deleteWorkspace.mutateAsync().then(() => { toast.success("Workspace deleted"); navigate("/dashboard", { replace: true }); }).catch(() => toast.error("Could not delete workspace")); }} />
    </div>
  );
}
