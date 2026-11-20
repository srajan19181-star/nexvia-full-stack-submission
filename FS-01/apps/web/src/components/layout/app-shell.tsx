import { Menu, Search } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { Outlet, useLocation, useParams } from "react-router-dom";
import { SpatialBackground } from "@/components/spatial/spatial-background";
import { Button } from "@/components/ui/button";
import { SearchDialog } from "@/features/workspaces/components/search-dialog";
import { usePage, useWorkspace } from "@/features/workspaces/queries";
import { useDocumentTitle } from "@/lib/use-document-title";
import { AppSidebar } from "./app-sidebar";
import { NotificationMenu } from "./notification-menu";
import { ThemeToggle } from "./theme-toggle";

export function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const reducedMotion = useReducedMotion();
  const { workspaceId = "", pageId = "" } = useParams();
  const workspace = useWorkspace(workspaceId);
  const page = usePage(workspaceId, pageId);
  const heading = pageId && page.data ? page.data.title : workspace.data?.name ?? "Your workspace";
  const subheading = workspace.data
    ? `${workspace.data.workspaceRole.toLowerCase()} · ${workspace.data.contentRole.toLowerCase()} access`
    : "Focused collaboration";
  useDocumentTitle(heading);

  return (
    <div className="relative isolate flex h-dvh overflow-hidden bg-[var(--background)]">
      <SpatialBackground className="fixed opacity-40" />
      <AppSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        <header className="relative z-50 flex h-16 shrink-0 items-center gap-3 border-b border-[var(--border)] bg-[var(--background)]/92 px-3 backdrop-blur-xl sm:px-5">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(true)} aria-label="Open navigation"><Menu className="size-5" /></Button>
          <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{heading}</p><p className="truncate text-xs text-[var(--muted-foreground)]">{subheading}</p></div>
          <button type="button" onClick={() => window.dispatchEvent(new Event("orvyn:open-search"))} className="hidden min-h-10 w-64 items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--muted-foreground)] transition hover:border-[var(--glass-border-strong)] hover:bg-[var(--surface-hover)] md:flex"><Search className="size-4 text-[var(--brand)]" /> Search anything<kbd className="ml-auto rounded-md border border-[var(--border)] px-1.5 py-0.5 text-[10px]">Ctrl K</kbd></button>
          <ThemeToggle />
          <NotificationMenu />
        </header>
        <main className="scrollbar-thin relative z-0 min-h-0 flex-1 overflow-y-auto">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={location.pathname}
              className="min-h-full"
              initial={reducedMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reducedMotion ? { opacity: 1 } : { opacity: 0, y: -4 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
      <SearchDialog />
    </div>
  );
}
