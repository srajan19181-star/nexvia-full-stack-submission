import { FileText, FolderKanban, Search } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useDeferredValue, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { LoadingSkeleton } from "@/components/ui/skeleton";
import { useSearchPages } from "../queries";

export function SearchDialog() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query.trim());
  const results = useSearchPages(deferredQuery);

  useEffect(() => {
    const openSearch = () => setOpen(true);
    const keyboard = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
      }
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("orvyn:open-search", openSearch);
    window.addEventListener("keydown", keyboard);
    return () => {
      window.removeEventListener("orvyn:open-search", openSearch);
      window.removeEventListener("keydown", keyboard);
    };
  }, []);

  const close = () => {
    setOpen(false);
    setQuery("");
  };
  const empty = Boolean(
    deferredQuery
    && results.data
    && results.data.pages.length === 0
    && results.data.workspaces.length === 0,
  );

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[80] grid place-items-start bg-[#02050e]/65 px-4 pt-[10vh] backdrop-blur-xl" onMouseDown={() => setOpen(false)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div role="dialog" aria-modal="true" aria-label="Search workspaces and pages" className="glass-panel w-full max-w-2xl overflow-hidden rounded-2xl border border-[var(--glass-border-strong)] bg-[var(--glass-strong)] shadow-[0_40px_100px_-35px_rgba(0,0,0,0.9)] backdrop-blur-3xl" onMouseDown={(event) => event.stopPropagation()} initial={{ opacity: 0, y: 18, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.985 }} transition={{ type: "spring", stiffness: 320, damping: 28 }}>
            <div className="flex items-center gap-3 border-b border-[var(--glass-border)] px-5"><Search className="size-5 text-[var(--brand-cyan)]" /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} className="min-h-14 flex-1 bg-transparent text-sm outline-none" placeholder="Search workspaces, page titles, and indexed content…" /><Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Esc</Button></div>
            <div className="scrollbar-thin max-h-[55vh] overflow-y-auto p-2">
              {!deferredQuery && <div className="p-10 text-center text-sm text-[var(--muted-foreground)]">Search across every workspace you can access.</div>}
              {deferredQuery && results.isPending && <div className="space-y-2 p-2"><LoadingSkeleton className="h-14" /><LoadingSkeleton className="h-14" /></div>}
              {results.isError && <div className="p-8 text-center text-sm text-[var(--danger)]">Search is temporarily unavailable.</div>}
              {results.data?.workspaces.length ? <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted-foreground)]">Workspaces</p> : null}
              {results.data?.workspaces.map((workspace) => <Link key={workspace.id} to={`/workspace/${workspace.id}`} onClick={close} className="flex items-center gap-3 rounded-xl p-3 transition hover:bg-[var(--glass-hover)]"><span className="grid size-9 place-items-center rounded-lg border border-[var(--glass-border)] bg-[var(--brand-soft)]"><FolderKanban className="size-4 text-[var(--brand)]" /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{workspace.name}</p><p className="truncate text-xs text-[var(--muted-foreground)]">Workspace</p></div><span className="text-[10px] text-[var(--muted-foreground)]">{new Date(workspace.updatedAt).toLocaleDateString()}</span></Link>)}
              {results.data?.pages.length ? <p className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted-foreground)]">Pages</p> : null}
              {results.data?.pages.map((page) => <Link key={page.id} to={`/workspace/${page.workspaceId}/page/${page.id}`} onClick={close} className="flex items-center gap-3 rounded-xl p-3 transition hover:bg-[var(--glass-hover)]"><span className="grid size-9 place-items-center rounded-lg border border-[var(--glass-border)] bg-[var(--glass)]">{page.icon ?? <FileText className="size-4 text-[var(--muted-foreground)]" />}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{page.title}</p><p className="truncate text-xs text-[var(--muted-foreground)]">{page.workspace.name}</p></div><span className="text-[10px] text-[var(--muted-foreground)]">{new Date(page.updatedAt).toLocaleDateString()}</span></Link>)}
              {empty && <div className="p-10 text-center text-sm text-[var(--muted-foreground)]">No results match “{deferredQuery}”.</div>}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
