import type { Editor } from "@tiptap/react";
import { Check, CornerDownRight, MessageSquarePlus, RotateCcw, Send, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type * as Y from "yjs";
import { Button } from "@/components/ui/button";
import { LoadingSkeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { createCommentAnchor, resolveCommentAnchor, type CommentAnchor } from "./comment-anchors";
import {
  useComments,
  useCreateComment,
  useDeleteComment,
  useDeleteCommentReply,
  useReplyToComment,
  useSetCommentResolved,
} from "./queries";
import type { CommentItem } from "./types";

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function relativeTime(value: string) {
  const seconds = Math.round((new Date(value).getTime() - Date.now()) / 1_000);
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  if (Math.abs(seconds) < 60) return formatter.format(seconds, "second");
  const minutes = Math.round(seconds / 60);
  if (Math.abs(minutes) < 60) return formatter.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return formatter.format(hours, "hour");
  return formatter.format(Math.round(hours / 24), "day");
}

function Avatar({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  return avatarUrl ? (
    <img src={avatarUrl} alt="" className="size-8 rounded-full object-cover" />
  ) : (
    <span className="grid size-8 place-items-center rounded-full bg-[var(--brand-soft)] text-[10px] font-bold text-[var(--brand)]">{initials(name)}</span>
  );
}

function CommentCard({
  comment,
  editor,
  document,
  canComment,
  onReply,
  onResolve,
  onDelete,
  onDeleteReply,
}: {
  comment: CommentItem;
  editor: Editor | null;
  document: Y.Doc;
  canComment: boolean;
  onReply: (commentId: string, body: string) => Promise<void>;
  onResolve: (commentId: string, resolved: boolean) => Promise<void>;
  onDelete: (commentId: string) => Promise<void>;
  onDeleteReply: (commentId: string, replyId: string) => Promise<void>;
}) {
  const [reply, setReply] = useState("");
  const [replying, setReplying] = useState(false);
  const anchor = editor && comment.anchorStart && comment.anchorEnd
    ? resolveCommentAnchor(editor, document, { start: comment.anchorStart, end: comment.anchorEnd })
    : null;
  const anchored = Boolean(comment.anchorStart && comment.anchorEnd);

  const focusAnchor = () => {
    if (!editor || !anchor) return;
    editor.chain().focus().setTextSelection(anchor).scrollIntoView().run();
  };

  return (
    <article className={cn("rounded-2xl border bg-[var(--glass)] p-3.5 shadow-[0_14px_40px_-32px_var(--glow-blue)] backdrop-blur-xl", comment.resolvedAt ? "border-[var(--glass-border)] opacity-75" : "border-[var(--glass-border-strong)]")}>
      <div className="flex items-start gap-2.5">
        <Avatar name={comment.author.name} avatarUrl={comment.author.avatarUrl} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2"><span className="truncate text-xs font-semibold">{comment.author.name}</span><time className="text-[10px] text-[var(--muted-foreground)]" dateTime={comment.createdAt}>{relativeTime(comment.createdAt)}</time></div>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-5">{comment.body}</p>
        </div>
        {comment.canDelete && canComment && <button type="button" onClick={() => void onDelete(comment.id)} className="rounded-md p-1 text-[var(--muted-foreground)] hover:bg-[var(--surface-hover)] hover:text-[var(--danger)]" aria-label="Delete comment"><Trash2 className="size-3.5" /></button>}
      </div>
      {anchored && (
        <button type="button" disabled={!anchor} onClick={focusAnchor} className="mt-3 w-full rounded-lg border-l-2 border-[var(--brand)] bg-[var(--surface-subtle)] px-3 py-2 text-left text-xs leading-5 text-[var(--muted-foreground)] disabled:cursor-default">
          {anchor ? `“${comment.anchorQuote}”` : "Original text changed or was removed"}
        </button>
      )}
      {comment.replies.length > 0 && <div className="mt-3 space-y-3 border-l border-[var(--border)] pl-3">{comment.replies.map((item) => <div key={item.id} className="flex gap-2"><Avatar name={item.author.name} avatarUrl={item.author.avatarUrl} /><div className="min-w-0 flex-1"><div className="flex items-baseline gap-2"><span className="truncate text-xs font-semibold">{item.author.name}</span><time className="text-[10px] text-[var(--muted-foreground)]">{relativeTime(item.createdAt)}</time></div><p className="mt-0.5 whitespace-pre-wrap text-xs leading-5">{item.body}</p></div>{item.canDelete && canComment && <button type="button" onClick={() => void onDeleteReply(comment.id, item.id)} className="self-start rounded-md p-1 text-[var(--muted-foreground)] hover:text-[var(--danger)]" aria-label="Delete reply"><Trash2 className="size-3" /></button>}</div>)}</div>}
      {replying && <form className="mt-3 flex gap-2" onSubmit={(event) => { event.preventDefault(); const body = reply.trim(); if (!body) return; void onReply(comment.id, body).then(() => { setReply(""); setReplying(false); }); }}><input value={reply} onChange={(event) => setReply(event.target.value)} autoFocus maxLength={5_000} className="min-w-0 flex-1 rounded-lg border border-[var(--glass-border)] bg-[var(--glass)] px-3 text-xs outline-none focus:border-[var(--brand-cyan)]" placeholder="Write a reply…" aria-label="Reply" /><Button size="icon" className="size-9 min-h-9" aria-label="Send reply"><Send className="size-3.5" /></Button></form>}
      {canComment && <div className="mt-3 flex items-center gap-1"><Button variant="ghost" size="sm" className="min-h-8 px-2" onClick={() => setReplying((value) => !value)}><CornerDownRight className="size-3.5" /> Reply</Button><Button variant="ghost" size="sm" className="min-h-8 px-2" onClick={() => void onResolve(comment.id, !comment.resolvedAt)}>{comment.resolvedAt ? <RotateCcw className="size-3.5" /> : <Check className="size-3.5" />}{comment.resolvedAt ? "Reopen" : "Resolve"}</Button></div>}
    </article>
  );
}

export function CommentsPanel({ workspaceId, pageId, document, editor, canComment, onClose }: { workspaceId: string; pageId: string; document: Y.Doc; editor: Editor | null; canComment: boolean; onClose: () => void }) {
  const [includeResolved, setIncludeResolved] = useState(true);
  const [draft, setDraft] = useState("");
  const [pendingAnchor, setPendingAnchor] = useState<CommentAnchor | null>(null);
  const [, setDocumentVersion] = useState(0);
  const comments = useComments(workspaceId, pageId, includeResolved);
  const create = useCreateComment(workspaceId, pageId);
  const reply = useReplyToComment(workspaceId, pageId);
  const resolve = useSetCommentResolved(workspaceId, pageId);
  const remove = useDeleteComment(workspaceId, pageId);
  const removeReply = useDeleteCommentReply(workspaceId, pageId);

  useEffect(() => {
    const update = () => setDocumentVersion((value) => value + 1);
    document.on("update", update);
    return () => document.off("update", update);
  }, [document]);

  const selectRange = () => {
    if (!editor) return;
    const anchor = createCommentAnchor(editor, document);
    if (!anchor) {
      toast.info("Select some document text first");
      return;
    }
    setPendingAnchor(anchor);
  };

  const submit = async () => {
    const body = draft.trim();
    if (!body) return;
    try {
      await create.mutateAsync({ body, ...(pendingAnchor ? { anchor: pendingAnchor } : {}) });
      setDraft("");
      setPendingAnchor(null);
      toast.success("Comment added");
    } catch {
      toast.error("Could not add the comment. Refresh the selection and try again.");
    }
  };

  const run = async (operation: () => Promise<unknown>, failure: string) => {
    try { await operation(); } catch { toast.error(failure); }
  };

  return (
    <aside className="glass-panel fixed bottom-3 right-3 top-[5.75rem] z-30 flex w-[calc(100%-1.5rem)] max-w-sm flex-col overflow-hidden rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-strong)] shadow-[0_28px_90px_-34px_var(--glow-blue)] backdrop-blur-2xl xl:sticky xl:top-3 xl:z-10 xl:mr-3 xl:mt-3 xl:h-[calc(100dvh-11rem)] xl:w-full" aria-label="Comments panel">
      <div className="flex items-center justify-between border-b border-[var(--glass-border)] px-4 py-3"><div><p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-[var(--brand-cyan)]">Live thread</p><h2 className="mt-0.5 text-sm font-semibold">Comments</h2><p className="text-[11px] text-[var(--muted-foreground)]">Discussion stays separate from document content.</p></div><Button variant="ghost" size="icon" onClick={onClose} aria-label="Close comments"><X className="size-4" /></Button></div>
      {canComment && <div className="space-y-2 border-b border-[var(--glass-border)] p-4"><textarea value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={5_000} rows={3} className="w-full resize-none rounded-xl border border-[var(--glass-border)] bg-[var(--glass)] px-3 py-2 text-sm outline-none transition focus:border-[var(--brand-cyan)] focus:ring-2 focus:ring-[var(--brand-soft)]" placeholder="Add context or ask a question…" aria-label="New comment" />{pendingAnchor && <div className="flex items-center justify-between rounded-lg bg-[var(--brand-soft)] px-2.5 py-1.5 text-xs text-[var(--brand-cyan)]"><span className="truncate">On “{pendingAnchor.quote}”</span><button type="button" onClick={() => setPendingAnchor(null)} aria-label="Remove text anchor"><X className="size-3.5" /></button></div>}<div className="flex items-center justify-between"><Button variant="ghost" size="sm" onMouseDown={(event) => event.preventDefault()} onClick={selectRange}><MessageSquarePlus className="size-3.5" /> Selected text</Button><Button size="sm" disabled={!draft.trim() || create.isPending} onClick={() => void submit()}><Send className="size-3.5" /> Comment</Button></div></div>}
      <label className="flex items-center gap-2 border-b border-[var(--glass-border)] px-4 py-2 text-xs text-[var(--muted-foreground)]"><input type="checkbox" checked={includeResolved} onChange={(event) => setIncludeResolved(event.target.checked)} className="accent-[var(--brand)]" /> Show resolved</label>
      <div className="scrollbar-thin flex-1 space-y-3 overflow-y-auto p-4">
        {comments.isPending && <><LoadingSkeleton className="h-36" /><LoadingSkeleton className="h-28" /></>}
        {comments.isError && <div className="rounded-xl border border-[var(--border)] p-4 text-center text-sm"><p>Comments could not load.</p><Button variant="secondary" size="sm" className="mt-3" onClick={() => void comments.refetch()}>Try again</Button></div>}
        {comments.data?.length === 0 && <div className="py-16 text-center"><MessageSquarePlus className="mx-auto size-8 text-[var(--muted-foreground)]" /><p className="mt-3 text-sm font-medium">No comments yet</p><p className="mt-1 text-xs text-[var(--muted-foreground)]">Start a document or selected-text discussion.</p></div>}
        {comments.data?.map((comment) => <CommentCard key={comment.id} comment={comment} editor={editor} document={document} canComment={canComment} onReply={(commentId, body) => run(() => reply.mutateAsync({ commentId, input: { body } }), "Could not post the reply")} onResolve={(commentId, resolved) => run(() => resolve.mutateAsync({ commentId, resolved }), "Could not update the comment")} onDelete={(commentId) => run(() => remove.mutateAsync(commentId), "Could not delete the comment")} onDeleteReply={(commentId, replyId) => run(() => removeReply.mutateAsync({ commentId, replyId }), "Could not delete the reply")} />)}
      </div>
    </aside>
  );
}
