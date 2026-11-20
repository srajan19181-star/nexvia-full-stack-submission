import { ArrowUpRight, Building2, FilePlus2, FileText, UsersRound } from "lucide-react";
import { motion } from "motion/react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Reveal } from "@/components/spatial/reveal";
import { SpatialCard } from "@/components/spatial/spatial-card";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LoadingSkeleton } from "@/components/ui/skeleton";
import { useCreatePage, usePages, useWorkspace } from "@/features/workspaces/queries";

export function WorkspaceHomePage() {
  const { workspaceId = "" } = useParams();
  const workspace = useWorkspace(workspaceId);
  const pages = usePages(workspaceId);
  const createPage = useCreatePage(workspaceId);
  const navigate = useNavigate();

  const create = async () => {
    try {
      const result = await createPage.mutateAsync({ title: "Untitled", parentId: null });
      navigate(`/workspace/${workspaceId}/page/${result.data.page.id}`);
    } catch {
      toast.error("Could not create a page");
    }
  };

  if (workspace.isPending || pages.isPending) {
    return (
      <div className="mx-auto max-w-6xl space-y-6 p-8">
        <LoadingSkeleton className="h-56 rounded-[2rem]" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <LoadingSkeleton className="h-44 rounded-2xl" />
          <LoadingSkeleton className="h-44 rounded-2xl" />
          <LoadingSkeleton className="h-44 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (workspace.isError || pages.isError) {
    return (
      <div className="grid min-h-[60vh] place-items-center p-6 text-center">
        <Card className="max-w-md p-8">
          <h1 className="text-2xl font-semibold">Workspace unavailable</h1>
          <p className="mt-2 text-sm text-[var(--muted-foreground)]">It may have been removed, or you may no longer have access.</p>
        </Card>
      </div>
    );
  }

  const roots = pages.data.filter((page) => page.parentId === null).slice(0, 8);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-8 sm:py-8 lg:px-10">
      <Reveal>
        <section className="relative overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-panel)] sm:p-8 lg:p-10">
          <div className="relative flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-1.5 text-xs font-medium text-[var(--brand)]">
                <Building2 className="size-3.5" /> Active workspace
              </span>
              <div className="mt-6 flex items-center gap-4">
                <span className="grid size-14 place-items-center rounded-xl border border-[var(--glass-border-strong)] bg-[var(--brand-soft)] text-xl font-semibold text-[var(--brand)]">
                  {workspace.data.name[0]?.toUpperCase()}
                </span>
                <div>
                  <h1 className="text-3xl font-semibold tracking-[-0.045em] sm:text-5xl">{workspace.data.name}</h1>
                  <p className="mt-1 text-sm capitalize text-[var(--muted-foreground)]">
                    {workspace.data.workspaceRole.toLowerCase()} · {workspace.data.contentRole.toLowerCase()} access
                  </p>
                </div>
              </div>
            </div>
            <Button size="lg" onClick={() => void create()} disabled={createPage.isPending}>
              <FilePlus2 className="size-4" /> {createPage.isPending ? "Creating…" : "New page"}
            </Button>
          </div>
          <div className="relative mt-8 grid gap-3 border-t border-[var(--glass-border)] pt-6 sm:grid-cols-2">
            <div className="flex items-center gap-3 rounded-2xl border border-[var(--glass-border)] bg-[var(--glass)] px-4 py-3">
              <span className="grid size-10 place-items-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand-cyan)]"><FileText className="size-4" /></span>
              <div><p className="text-xl font-semibold">{workspace.data.pageCount}</p><p className="text-xs text-[var(--muted-foreground)]">Active pages</p></div>
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-[var(--glass-border)] bg-[var(--glass)] px-4 py-3">
              <span className="grid size-10 place-items-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)]"><UsersRound className="size-4" /></span>
              <div><p className="text-xl font-semibold">{workspace.data.memberCount}</p><p className="text-xs text-[var(--muted-foreground)]">Workspace members</p></div>
            </div>
          </div>
        </section>
      </Reveal>

      <section className="mt-10">
        <div className="mb-5 flex items-end justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--brand)]">Documents</p>
            <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em]">Top-level pages</h2>
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">Open a page or use the sidebar to browse the full tree.</p>
          </div>
          <span className="hidden text-xs text-[var(--muted-foreground)] sm:block">{roots.length} visible</span>
        </div>
        {roots.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {roots.map((page, index) => (
              <motion.div key={page.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.045 }}>
                <SpatialCard className="h-full rounded-2xl" intensity={5}>
                  <button
                    type="button"
                    onClick={() => navigate(`/workspace/${workspaceId}/page/${page.id}`)}
                    className="group relative flex min-h-44 w-full flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 text-left shadow-[var(--shadow-panel)]"
                  >
                    <div className="absolute -right-12 -top-12 size-36 rounded-full bg-[var(--glow-cyan)] opacity-0 blur-3xl transition-opacity group-hover:opacity-15" />
                    <div className="relative flex items-start justify-between">
                      <span className="grid size-11 place-items-center rounded-xl border border-[var(--glass-border)] bg-[var(--glass-strong)] text-lg">
                        {page.icon ?? <FileText className="size-4 text-[var(--brand-cyan)]" />}
                      </span>
                      <ArrowUpRight className="size-4 text-[var(--muted-foreground)] transition-colors group-hover:text-[var(--brand-cyan)]" />
                    </div>
                    <p className="relative mt-5 truncate font-medium">{page.title}</p>
                    <p className="relative mt-auto pt-3 text-xs text-[var(--muted-foreground)]">Updated {new Date(page.updatedAt).toLocaleDateString()}</p>
                  </button>
                </SpatialCard>
              </motion.div>
            ))}
          </div>
        ) : (
          <Card className="grid min-h-64 place-items-center p-8 text-center">
            <div className="max-w-sm">
              <span className="mx-auto grid size-16 place-items-center rounded-2xl border border-[var(--glass-border)] bg-[var(--brand-soft)] text-[var(--brand-cyan)]"><FileText className="size-7" /></span>
              <h3 className="mt-5 font-semibold">No pages yet</h3>
              <p className="mt-2 text-sm text-[var(--muted-foreground)]">Create the first shared document in this workspace.</p>
              <Button className="mt-5" onClick={() => void create()}>Create page</Button>
            </div>
          </Card>
        )}
      </section>
    </div>
  );
}
