import { Activity, LayoutDashboard, Plus, Search, Settings, Users, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { NavLink, useNavigate, useParams, type NavLinkRenderProps } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageTree } from "@/features/pages/page-tree";
import { WorkspaceSwitcher } from "@/features/workspaces/components/workspace-switcher";
import { useCreatePage } from "@/features/workspaces/queries";
import { cn } from "@/lib/utils";
import { Logo } from "./logo";
import { UserMenu } from "./user-menu";

function navClass({ isActive }: NavLinkRenderProps) {
  return cn(
    "flex min-h-10 items-center gap-2.5 rounded-lg border px-3 text-sm transition duration-200",
    isActive
      ? "border-[var(--border)] bg-[var(--surface-hover)] font-medium text-[var(--foreground)] shadow-[inset_3px_0_0_var(--brand)]"
      : "border-transparent text-[var(--muted-foreground)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]",
  );
}

export function AppSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { workspaceId } = useParams();
  const navigate = useNavigate();
  const createPage = useCreatePage(workspaceId ?? "");
  const [desktop, setDesktop] = useState(() => window.matchMedia("(min-width: 1024px)").matches);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const update = () => setDesktop(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  const addRootPage = async () => {
    if (!workspaceId) return;
    try {
      const result = await createPage.mutateAsync({ title: "Untitled", parentId: null });
      navigate(`/workspace/${workspaceId}/page/${result.data.page.id}`);
      onClose();
    } catch {
      toast.error("Could not create the page");
    }
  };

  return (
    <>
      <AnimatePresence>
        {open && !desktop && (
          <motion.button
            type="button"
            aria-label="Close navigation"
            onClick={onClose}
            className="fixed inset-0 z-40 bg-[#050a12]/75 backdrop-blur-sm lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
        )}
      </AnimatePresence>
      <motion.aside
        initial={false}
        animate={{ x: desktop || open ? 0 : -300 }}
        transition={{ type: "spring", stiffness: 330, damping: 34 }}
        className="fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col border-r border-[var(--border)] bg-[var(--surface)] p-3 shadow-2xl lg:static lg:z-auto lg:h-dvh lg:shadow-none"
      >
        <div className="flex h-12 items-center justify-between px-2">
          <Logo />
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={onClose} aria-label="Close navigation"><X className="size-4.5" /></Button>
        </div>

        <WorkspaceSwitcher {...(workspaceId ? { currentWorkspaceId: workspaceId } : {})} />

        <button type="button" onClick={() => window.dispatchEvent(new Event("orvyn:open-search"))} className="mt-2 flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm text-[var(--muted-foreground)] transition hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]">
          <Search className="size-4 text-[var(--brand)]" /><span className="flex-1 text-left">Search</span><kbd className="rounded-md border border-[var(--border)] bg-[var(--surface-subtle)] px-1.5 py-0.5 text-[10px]">Ctrl K</kbd>
        </button>

        <nav className="mt-4 space-y-1" aria-label="Workspace navigation">
          <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted-foreground)]">Workspace</p>
          <NavLink to="/dashboard" onClick={onClose} className={navClass}><LayoutDashboard className="size-4" /> Dashboard</NavLink>
          {workspaceId && (
            <>
              <NavLink to={`/workspace/${workspaceId}/members`} onClick={onClose} className={navClass}><Users className="size-4" /> Members</NavLink>
              <NavLink to={`/workspace/${workspaceId}/activity`} onClick={onClose} className={navClass}><Activity className="size-4" /> Activity</NavLink>
              <NavLink to={`/workspace/${workspaceId}/settings`} onClick={onClose} className={navClass}><Settings className="size-4" /> Workspace settings</NavLink>
            </>
          )}
        </nav>

        {workspaceId && (
          <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto pt-5">
            <div className="flex items-center justify-between px-3">
              <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted-foreground)]">Documents</span>
              <button type="button" onClick={() => void addRootPage()} className="rounded-md p-1 text-[var(--muted-foreground)] transition hover:bg-[var(--surface-hover)] hover:text-[var(--brand)]" aria-label="Create page"><Plus className="size-4" /></button>
            </div>
            <PageTree workspaceId={workspaceId} />
          </div>
        )}

        <div className={cn("mt-auto pt-3", workspaceId && "border-t border-[var(--border)]")}><UserMenu /></div>
      </motion.aside>
    </>
  );
}
