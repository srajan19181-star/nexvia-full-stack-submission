import type { Editor } from "@tiptap/react";
import { Check, ChevronRight, Cloud, CloudOff, FileText, History, LoaderCircle, MessageSquare, Radio, Share2, Star, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { LoadingSkeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/features/auth/auth-provider";
import { CommentsPanel } from "@/features/comments/comments-panel";
import { CollaborativeEditor } from "@/features/editor/collaborative-editor";
import { collaboratorColor } from "@/features/editor/editor-utils";
import { OnlineAvatars } from "@/features/editor/online-avatars";
import { useCollaboration, type ConnectionState, type SaveState } from "@/features/editor/use-collaboration";
import { VersionHistoryPanel } from "@/features/history/version-history-panel";
import { ShareDialog } from "@/features/sharing/share-dialog";
import { useDeletePage, usePage, useSetFavorite, useUpdatePage, useWorkspace } from "@/features/workspaces/queries";
import { cn } from "@/lib/utils";

function SaveIndicator({ connection, save }: { connection: ConnectionState; save: SaveState }) {
  if (connection === "forbidden") return <span className="flex items-center gap-1.5 text-xs text-[var(--danger)]"><CloudOff className="size-3.5" /> Access changed</span>;
  if (connection === "disconnected" || save === "queued") return <span className="flex items-center gap-1.5 text-xs text-[var(--warning)]"><CloudOff className="size-3.5" /> Offline edits queued</span>;
  if (connection === "connecting" || save === "connecting") return <span className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)]"><LoaderCircle className="size-3.5 animate-spin" /> Connecting</span>;
  if (save === "saving") return <span className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)]"><Cloud className="size-3.5" /> Saving</span>;
  return <span className="flex items-center gap-1.5 text-xs text-[var(--success)]"><Check className="size-3.5" /> Saved</span>;
}

export function EditorPage() {
  const { workspaceId = "", pageId = "" } = useParams();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const workspace = useWorkspace(workspaceId);
  const page = usePage(workspaceId, pageId);
  const updatePage = useUpdatePage(workspaceId, pageId);
  const deletePage = useDeletePage(workspaceId, pageId);
  const favorite = useSetFavorite(workspaceId);
  const reloadDocumentGeneration = useCallback(() => { void page.refetch(); }, [page]);
  const collaboration = useCollaboration(
    pageId,
    page.data?.documentGeneration ?? 1,
    Boolean(page.data && user),
    reloadDocumentGeneration,
  );
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(searchParams.get("history") === "1");
  const editorRef = useRef<Editor | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const handleEditorReady = useCallback((value: Editor | null) => {
    editorRef.current = value;
  }, []);
  const collaborator = useMemo(() => user ? {
    id: user.id,
    name: user.name,
    avatarUrl: user.avatarUrl,
    color: collaboratorColor(user.id),
  } : null, [user]);

  useEffect(() => { if (page.data) setTitle(page.data.title); }, [page.data]);

  const saveTitle = async () => {
    const normalized = title.trim() || "Untitled";
    setTitle(normalized);
    if (!page.data || normalized === page.data.title) return;
    try {
      await updatePage.mutateAsync({ title: normalized });
    } catch {
      toast.error("Could not rename the page");
    }
  };

  if (page.isPending || workspace.isPending) {
    return (
      <div className="mx-auto max-w-5xl space-y-5 px-8 py-12">
        <LoadingSkeleton className="h-16 rounded-2xl" />
        <LoadingSkeleton className="h-32 rounded-2xl" />
        <LoadingSkeleton className="h-[540px] rounded-[2rem]" />
      </div>
    );
  }

  if (page.isError || workspace.isError) {
    return (
      <div className="grid min-h-[60vh] place-items-center p-6 text-center">
        <div className="glass-panel rounded-2xl border border-[var(--glass-border)] bg-[var(--glass)] p-8 shadow-[var(--shadow-panel)] backdrop-blur-2xl">
          <h1 className="text-2xl font-semibold">Page unavailable</h1>
          <p className="mt-2 text-sm text-[var(--muted-foreground)]">It may be in trash, or your access changed.</p>
          <Button className="mt-5" onClick={() => navigate(`/workspace/${workspaceId}`)}>Back to workspace</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-full">
      <div className="sticky top-0 z-20 p-2 pb-0 sm:p-3 sm:pb-0">
        <header className="glass-panel flex min-h-14 items-center gap-2 rounded-2xl border border-[var(--glass-border)] bg-[var(--glass)] px-3 shadow-[0_18px_60px_-38px_var(--glow-cyan)] backdrop-blur-2xl sm:px-4">
          <Link to={`/workspace/${workspaceId}`} className="hidden max-w-36 truncate text-xs text-[var(--muted-foreground)] transition hover:text-[var(--brand-cyan)] sm:block">{workspace.data.name}</Link>
          <ChevronRight className="hidden size-3.5 text-[var(--muted-foreground)] sm:block" />
          <span className="min-w-0 flex-1 truncate text-xs font-medium">{page.data.title}</span>
          {!page.data.permissions?.edit && <span className="hidden rounded-full border border-[var(--border)] bg-[var(--surface-subtle)] px-2.5 py-1 text-xs font-medium text-[var(--muted-foreground)] sm:inline-flex">Read only</span>}
          <OnlineAvatars members={collaboration.onlineMembers} />
          <span className="hidden rounded-full border border-[var(--glass-border)] bg-[var(--glass)] px-2.5 py-1.5 sm:flex"><SaveIndicator connection={collaboration.connectionState} save={collaboration.saveState} /></span>
          <Button variant="ghost" size="icon" className={cn("size-9 min-h-9", commentsOpen && "bg-[var(--brand-soft)] text-[var(--brand-cyan)]")} onClick={() => { setCommentsOpen((value) => !value); setHistoryOpen(false); }} aria-label="Toggle comments"><MessageSquare className="size-4" /></Button>
          <Button variant="ghost" size="icon" className={cn("hidden size-9 min-h-9 sm:inline-flex", historyOpen && "bg-[var(--brand-soft)] text-[var(--brand)]")} onClick={() => { setHistoryOpen((value) => !value); setCommentsOpen(false); }} aria-label="Toggle version history"><History className="size-4" /></Button>
          <Button variant="ghost" size="icon" className="hidden size-9 min-h-9 sm:inline-flex" onClick={() => void favorite.mutateAsync({ pageId, favorite: !page.data.isFavorite })} aria-label={page.data.isFavorite ? "Remove favorite" : "Add favorite"}><Star className={cn("size-4", page.data.isFavorite && "fill-current text-[var(--warning)]")} /></Button>
          <Button variant="secondary" size="sm" onClick={() => setShareOpen(true)}><Share2 className="size-3.5" /><span className="hidden sm:inline">Share</span></Button>
          {page.data.permissions?.edit && <Button variant="ghost" size="icon" className="hidden size-9 min-h-9 md:inline-flex" onClick={() => setConfirmDelete(true)} aria-label="Move to trash"><Trash2 className="size-4" /></Button>}
        </header>
      </div>

      <div className={cn("grid", (commentsOpen || historyOpen) && "xl:grid-cols-[minmax(0,1fr)_24rem]")}>
        <article className="relative mx-auto w-full max-w-[1000px] px-4 pb-32 pt-10 sm:px-8 sm:pt-14 lg:px-12">
          <div className="pointer-events-none absolute left-1/2 top-8 -z-10 h-80 w-4/5 -translate-x-1/2 rounded-full bg-[var(--glow-cyan)] opacity-[0.05] blur-[100px]" />
          <div className="flex items-start gap-4">
            <button type="button" className="grid size-14 shrink-0 place-items-center rounded-2xl border border-[var(--glass-border)] bg-[var(--glass)] text-2xl shadow-[var(--shadow-panel)] backdrop-blur-xl transition hover:border-[var(--glass-border-strong)]" aria-label="Page icon">
              {page.data.icon ?? <FileText className="size-6 text-[var(--brand-cyan)]" />}
            </button>
            <div className="min-w-0 flex-1">
              <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--brand-cyan)]"><Radio className="size-3" /> Live document</div>
              <input value={title} onChange={(event) => setTitle(event.target.value)} onBlur={() => void saveTitle()} disabled={!page.data.permissions?.edit} className="w-full bg-transparent text-3xl font-semibold tracking-[-0.045em] outline-none placeholder:text-[var(--muted-foreground)] sm:text-5xl" aria-label="Page title" />
            </div>
          </div>
          <div className="mt-5 flex sm:hidden"><SaveIndicator connection={collaboration.connectionState} save={collaboration.saveState} /></div>
          {collaboration.errorMessage && <div className="mt-6 rounded-xl border border-[color-mix(in_oklab,var(--danger)_35%,var(--border))] bg-[color-mix(in_oklab,var(--danger)_8%,var(--glass))] px-4 py-3 text-sm text-[var(--danger)] backdrop-blur-xl">{collaboration.errorMessage}</div>}
          <div className="mt-8">
            {collaboration.resource && collaborator ? (
              <CollaborativeEditor
                document={collaboration.resource.document}
                provider={collaboration.resource.provider}
                currentUser={collaborator}
                editable={Boolean(page.data.permissions?.edit) && collaboration.connectionState !== "forbidden"}
                onEditorReady={handleEditorReady}
              />
            ) : (
              <LoadingSkeleton className="h-[540px] rounded-[2rem]" />
            )}
          </div>
          {!page.data.permissions?.edit && <p className="mt-4 text-center text-xs text-[var(--muted-foreground)]">You have read-only access. Document changes are disabled.</p>}
        </article>
        {commentsOpen && collaboration.resource && <CommentsPanel workspaceId={workspaceId} pageId={pageId} document={collaboration.resource.document} editor={editorRef.current} canComment={Boolean(page.data.permissions?.comment)} onClose={() => setCommentsOpen(false)} />}
        {historyOpen && collaborator && <VersionHistoryPanel workspaceId={workspaceId} pageId={pageId} canRestore={Boolean(page.data.permissions?.edit) && collaboration.connectionState === "connected"} currentUser={collaborator} onClose={() => setHistoryOpen(false)} />}
      </div>

      <ConfirmDialog open={confirmDelete} onOpenChange={setConfirmDelete} title={`Move "${page.data.title}" to trash?`} description="This page and its nested pages can be restored from workspace settings." confirmLabel="Move to trash" destructive busy={deletePage.isPending} onConfirm={() => { void deletePage.mutateAsync().then(() => { toast.success("Page moved to trash"); navigate(`/workspace/${workspaceId}`); }).catch(() => toast.error("Could not move the page")); }} />
      <ShareDialog workspaceId={workspaceId} pageId={pageId} pageTitle={page.data.title} open={shareOpen} onOpenChange={setShareOpen} canManage={workspace.data.workspaceRole === "OWNER" || workspace.data.workspaceRole === "ADMIN"} />
    </div>
  );
}
