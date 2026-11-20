import { ArrowDown, ArrowUp, ChevronRight, FileText, Plus, Star, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { LoadingSkeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useCreatePage, useDeletePage, usePages, useReorderPages, useSetFavorite } from "@/features/workspaces/queries";
import type { PageItem } from "@/features/workspaces/types";

interface PageBranch extends PageItem {
  children: PageBranch[];
}

function buildTree(pages: PageItem[]): PageBranch[] {
  const branches = new Map<string, PageBranch>();
  for (const page of pages) branches.set(page.id, { ...page, children: [] });
  const roots: PageBranch[] = [];
  for (const branch of branches.values()) {
    const parent = branch.parentId ? branches.get(branch.parentId) : undefined;
    if (parent && parent.id !== branch.id) parent.children.push(branch);
    else roots.push(branch);
  }
  const sort = (items: PageBranch[]) => {
    items.sort((left, right) => left.sortOrder - right.sortOrder);
    items.forEach((item) => sort(item.children));
  };
  sort(roots);
  return roots;
}

export function PageTree({ workspaceId }: { workspaceId: string }) {
  const pages = usePages(workspaceId);
  const createPage = useCreatePage(workspaceId);
  const favorite = useSetFavorite(workspaceId);
  const reorderPages = useReorderPages(workspaceId);
  const navigate = useNavigate();
  const { pageId: selectedPageId } = useParams();
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<PageItem | null>(null);
  const deletePage = useDeletePage(workspaceId, deleteTarget?.id ?? "");
  const tree = useMemo(() => buildTree(pages.data ?? []), [pages.data]);

  const create = async (parentId: string | null) => {
    try {
      const result = await createPage.mutateAsync({ title: "Untitled", parentId });
      navigate(`/workspace/${workspaceId}/page/${result.data.page.id}`);
    } catch {
      toast.error("Could not create the page");
    }
  };

  const reorder = async (siblings: PageBranch[], index: number, direction: -1 | 1) => {
    const destination = index + direction;
    if (destination < 0 || destination >= siblings.length) return;
    const orderedPageIds = siblings.map((page) => page.id);
    [orderedPageIds[index], orderedPageIds[destination]] = [orderedPageIds[destination]!, orderedPageIds[index]!];
    try {
      await reorderPages.mutateAsync({ parentId: siblings[index]?.parentId ?? null, orderedPageIds });
    } catch {
      toast.error("Could not reorder the page");
    }
  };

  const renderBranch = (branch: PageBranch, depth: number, siblings: PageBranch[], index: number): React.ReactNode => {
    const isCollapsed = collapsed.has(branch.id);
    return (
      <div key={branch.id}>
        <div className={cn("group flex min-h-9 items-center rounded-lg border pr-1 transition", branch.id === selectedPageId ? "border-[var(--glass-border)] bg-[var(--glass-hover)] shadow-[inset_2px_0_0_var(--brand-cyan)]" : "border-transparent hover:bg-[var(--glass-hover)]")} style={{ paddingLeft: `${Math.min(depth, 8) * 12 + 4}px` }}>
          <button type="button" className={cn("grid size-7 place-items-center rounded text-[var(--muted-foreground)]", branch.children.length === 0 && "invisible")} onClick={() => setCollapsed((current) => { const next = new Set(current); if (next.has(branch.id)) next.delete(branch.id); else next.add(branch.id); return next; })} aria-label={isCollapsed ? "Expand page" : "Collapse page"}>
            <ChevronRight className={cn("size-3.5 transition", !isCollapsed && "rotate-90")} />
          </button>
          <Link to={`/workspace/${workspaceId}/page/${branch.id}`} className="flex min-w-0 flex-1 items-center gap-2 py-1.5 text-sm">
            <span className="shrink-0">{branch.icon ?? <FileText className="size-3.5 text-[var(--muted-foreground)]" />}</span>
            <span className="truncate">{branch.title}</span>
          </Link>
          <div className="hidden items-center group-hover:flex group-focus-within:flex">
            <button type="button" className="rounded p-1 text-[var(--muted-foreground)] hover:text-[var(--brand)] disabled:opacity-30" disabled={index === 0 || reorderPages.isPending} onClick={() => void reorder(siblings, index, -1)} aria-label="Move page up"><ArrowUp className="size-3.5" /></button>
            <button type="button" className="rounded p-1 text-[var(--muted-foreground)] hover:text-[var(--brand)] disabled:opacity-30" disabled={index === siblings.length - 1 || reorderPages.isPending} onClick={() => void reorder(siblings, index, 1)} aria-label="Move page down"><ArrowDown className="size-3.5" /></button>
            <button type="button" className="rounded p-1 text-[var(--muted-foreground)] hover:text-[var(--brand)]" onClick={() => void favorite.mutateAsync({ pageId: branch.id, favorite: !branch.isFavorite })} aria-label={branch.isFavorite ? "Remove favorite" : "Add favorite"}><Star className={cn("size-3.5", branch.isFavorite && "fill-current text-[var(--warning)]")} /></button>
            <button type="button" className="rounded p-1 text-[var(--muted-foreground)] hover:text-[var(--brand)]" onClick={() => void create(branch.id)} aria-label="Add child page"><Plus className="size-3.5" /></button>
            <button type="button" className="rounded p-1 text-[var(--muted-foreground)] hover:text-[var(--danger)]" onClick={() => setDeleteTarget(branch)} aria-label="Move page to trash"><Trash2 className="size-3.5" /></button>
          </div>
        </div>
        {!isCollapsed && branch.children.map((child, childIndex) => renderBranch(child, depth + 1, branch.children, childIndex))}
      </div>
    );
  };

  if (pages.isPending) return <div className="mt-2 space-y-2"><LoadingSkeleton className="h-8" /><LoadingSkeleton className="h-8 w-4/5" /></div>;
  if (pages.isError) return <p className="mt-3 px-3 text-xs text-[var(--danger)]">Pages could not be loaded.</p>;

  return (
    <>
      <div className="mt-2 space-y-0.5">
        {tree.map((branch, index) => renderBranch(branch, 0, tree, index))}
        {tree.length === 0 && <button type="button" onClick={() => void create(null)} className="w-full rounded-xl border border-dashed border-[var(--glass-border-strong)] p-4 text-center text-xs text-[var(--muted-foreground)] hover:bg-[var(--glass-hover)]"><FileText className="mx-auto mb-2 size-5" />Create your first page</button>}
      </div>
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={`Move “${deleteTarget?.title ?? "page"}” to trash?`}
        description="This page and its nested pages will be hidden. An editor can restore them from workspace settings."
        confirmLabel="Move to trash"
        destructive
        busy={deletePage.isPending}
        onConfirm={() => {
          void deletePage.mutateAsync().then(() => {
            toast.success("Page moved to trash");
            setDeleteTarget(null);
            if (selectedPageId === deleteTarget?.id) navigate(`/workspace/${workspaceId}`);
          }).catch(() => toast.error("Could not move the page to trash"));
        }}
      />
    </>
  );
}
