import { History, LoaderCircle, Plus, RotateCcw, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import * as Y from "yjs";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Modal } from "@/components/ui/modal";
import { LoadingSkeleton } from "@/components/ui/skeleton";
import { CollaborativeEditor } from "@/features/editor/collaborative-editor";
import type { CollaboratorIdentity } from "@/features/editor/editor-utils";
import { cn } from "@/lib/utils";
import { useCreateSnapshot, useRestoreSnapshot, useSnapshotPreview, useVersionHistory } from "./queries";
import type { SnapshotItem } from "./types";

function decode(value: string): Uint8Array {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function kindLabel(kind: SnapshotItem["kind"]) {
  if (kind === "MILESTONE") return "Named version";
  if (kind === "PRE_RESTORE") return "Before restore";
  if (kind === "RESTORE") return "Restored version";
  return "Automatic version";
}

function SnapshotDocument({ state, currentUser }: { state: string; currentUser: CollaboratorIdentity }) {
  const document = useMemo(() => {
    const value = new Y.Doc();
    Y.applyUpdate(value, decode(state));
    return value;
  }, [state]);
  useEffect(() => () => document.destroy(), [document]);
  return <CollaborativeEditor document={document} currentUser={currentUser} editable={false} />;
}

export function VersionHistoryPanel({ workspaceId, pageId, canRestore, currentUser, onClose }: { workspaceId: string; pageId: string; canRestore: boolean; currentUser: CollaboratorIdentity; onClose: () => void }) {
  const history = useVersionHistory(workspaceId, pageId);
  const create = useCreateSnapshot(workspaceId, pageId);
  const restore = useRestoreSnapshot(workspaceId, pageId);
  const [label, setLabel] = useState("");
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<SnapshotItem | null>(null);
  const preview = useSnapshotPreview(workspaceId, pageId, previewId);

  const createVersion = async () => {
    const versionLabel = label.trim();
    try {
      await create.mutateAsync(versionLabel ? { label: versionLabel } : {});
      setLabel("");
      toast.success("Version saved");
    } catch {
      toast.error("Could not save this version");
    }
  };

  const restoreVersion = async () => {
    if (!restoreTarget) return;
    try {
      await restore.mutateAsync({ snapshotId: restoreTarget.id, input: { label: `Restored ${restoreTarget.label ?? "version"}` } });
      setRestoreTarget(null);
      setPreviewId(null);
      onClose();
      toast.success("Revision restored. The live document is reloading.");
    } catch {
      toast.error("Could not restore this revision");
    }
  };

  return (
    <aside className="glass-panel fixed bottom-3 right-3 top-[5.75rem] z-30 flex w-[calc(100%-1.5rem)] max-w-sm flex-col overflow-hidden rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-strong)] shadow-2xl backdrop-blur-2xl xl:sticky xl:top-3 xl:z-10 xl:mr-3 xl:mt-3 xl:h-[calc(100dvh-11rem)] xl:w-full" aria-label="Version history panel">
      <div className="flex items-center justify-between border-b border-[var(--glass-border)] px-4 py-3"><div><p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-[var(--brand)]">Snapshot timeline</p><h2 className="mt-0.5 text-sm font-semibold">Version history</h2><p className="text-[11px] text-[var(--muted-foreground)]">Immutable snapshots remain available after restores.</p></div><Button variant="ghost" size="icon" onClick={onClose} aria-label="Close version history"><X className="size-4" /></Button></div>
      {canRestore && <div className="flex gap-2 border-b border-[var(--glass-border)] p-4"><input value={label} onChange={(event) => setLabel(event.target.value)} maxLength={120} className="min-w-0 flex-1 rounded-lg border border-[var(--glass-border)] bg-[var(--glass)] px-3 text-xs outline-none focus:border-[var(--brand)]" placeholder="Name this version" aria-label="Version label" /><Button size="sm" onClick={() => void createVersion()} disabled={create.isPending}><Plus className="size-3.5" /> Save</Button></div>}
      <div className="scrollbar-thin flex-1 overflow-y-auto p-3">
        {history.isPending && <div className="space-y-2"><LoadingSkeleton className="h-20" /><LoadingSkeleton className="h-20" /><LoadingSkeleton className="h-20" /></div>}
        {history.isError && <div className="rounded-xl border border-[var(--border)] p-5 text-center text-sm"><p>History could not load.</p><Button size="sm" variant="secondary" className="mt-3" onClick={() => void history.refetch()}>Try again</Button></div>}
        {history.data?.items.length === 0 && <div className="py-16 text-center"><History className="mx-auto size-8 text-[var(--muted-foreground)]" /><p className="mt-3 text-sm font-medium">No versions yet</p><p className="mt-1 text-xs text-[var(--muted-foreground)]">Named and automatic versions will appear here.</p></div>}
        <div className="space-y-2">{history.data?.items.map((snapshot) => <button key={snapshot.id} type="button" onClick={() => setPreviewId(snapshot.id)} className={cn("w-full rounded-xl border px-3 py-3 text-left transition hover:border-[var(--glass-border-strong)] hover:bg-[var(--glass-hover)]", previewId === snapshot.id ? "border-[var(--glass-border-strong)] bg-[var(--brand-soft)]" : "border-[var(--glass-border)] bg-[var(--glass)]")}><div className="flex items-center justify-between gap-2"><span className="truncate text-xs font-semibold">{snapshot.label ?? kindLabel(snapshot.kind)}</span><span className="shrink-0 rounded-full border border-[var(--glass-border)] px-2 py-0.5 text-[9px] text-[var(--muted-foreground)]">Gen {snapshot.generation}</span></div><p className="mt-1 text-[11px] text-[var(--muted-foreground)]">{kindLabel(snapshot.kind)} · {new Date(snapshot.createdAt).toLocaleString()}</p><p className="mt-0.5 truncate text-[11px] text-[var(--muted-foreground)]">{snapshot.createdBy?.name ?? "System"}</p></button>)}</div>
      </div>
      <Modal open={Boolean(previewId)} onOpenChange={(open) => !open && setPreviewId(null)} size="xl" title={preview.data?.label ?? "Revision preview"} description={preview.data ? `${kindLabel(preview.data.kind)} · ${new Date(preview.data.createdAt).toLocaleString()}` : "Loading immutable document state…"} footer={canRestore && preview.data ? <Button onClick={() => { setRestoreTarget(history.data?.items.find((item) => item.id === preview.data?.id) ?? null); setPreviewId(null); }}><RotateCcw className="size-4" /> Restore this version</Button> : undefined}>
        {preview.isPending && <LoadingSkeleton className="h-[520px] rounded-2xl" />}
        {preview.isError && <div className="grid h-80 place-items-center text-center text-sm text-[var(--muted-foreground)]">This revision could not be previewed.</div>}
        {preview.data && <div className="max-h-[65vh] overflow-y-auto"><SnapshotDocument state={preview.data.state} currentUser={currentUser} /></div>}
      </Modal>
      <ConfirmDialog open={Boolean(restoreTarget)} onOpenChange={(open) => !open && setRestoreTarget(null)} title="Restore this revision?" description="Current content is saved as a pre-restore version. Connected clients reload onto a new document generation so every editor converges safely." confirmLabel="Restore revision" busy={restore.isPending} onConfirm={() => void restoreVersion()} />
      {restore.isPending && <div className="absolute inset-0 grid place-items-center bg-[color-mix(in_oklab,var(--surface)_80%,transparent)]"><span className="flex items-center gap-2 rounded-xl bg-[var(--surface)] px-4 py-3 text-sm shadow-lg"><LoaderCircle className="size-4 animate-spin" /> Restoring revision…</span></div>}
    </aside>
  );
}
