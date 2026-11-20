import {
  Activity,
  ArrowRight,
  Clock3,
  FileClock,
  FilePlus2,
  FileText,
  FolderKanban,
  Plus,
  UsersRound,
} from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Reveal } from "@/components/spatial/reveal";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LoadingSkeleton } from "@/components/ui/skeleton";
import { ActivityFeed } from "@/features/activity/activity-feed";
import { useAuth } from "@/features/auth/auth-provider";
import { CreateWorkspaceDialog } from "@/features/workspaces/components/create-workspace-dialog";
import { useCreatePage, useDashboard } from "@/features/workspaces/queries";
import { useDocumentTitle } from "@/lib/use-document-title";

function formatUpdatedAt(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: new Date(value).getFullYear() === new Date().getFullYear() ? undefined : "numeric",
  }).format(new Date(value));
}

export function DashboardPage() {
  useDocumentTitle("Dashboard");
  const { user } = useAuth();
  const dashboard = useDashboard();
  const navigate = useNavigate();
  const [createWorkspaceOpen, setCreateWorkspaceOpen] = useState(false);
  const createPage = useCreatePage(dashboard.data?.workspaces[0]?.id ?? "");

  if (dashboard.isPending) {
    return (
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-10">
        <LoadingSkeleton className="h-64 rounded-3xl" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((item) => <LoadingSkeleton key={item} className="h-28 rounded-2xl" />)}
        </div>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(300px,0.55fr)]">
          <LoadingSkeleton className="h-96 rounded-2xl" />
          <LoadingSkeleton className="h-96 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (dashboard.isError) {
    return (
      <div className="grid min-h-[60vh] place-items-center p-6 text-center">
        <Card className="max-w-md p-8">
          <h1 className="text-2xl font-semibold">Dashboard unavailable</h1>
          <p className="mt-2 text-sm text-[var(--muted-foreground)]">We could not load your workspace overview.</p>
          <Button className="mt-5" onClick={() => void dashboard.refetch()}>Try again</Button>
        </Card>
      </div>
    );
  }

  const data = dashboard.data;
  const primaryWorkspace = data.workspaces[0];
  const continuePage = data.recentPages[0];
  const documentCount = data.workspaces.reduce((total, workspace) => total + workspace.pageCount, 0);
  const teamSeats = data.workspaces.reduce((total, workspace) => total + workspace.memberCount, 0);

  const createDocument = async () => {
    if (!primaryWorkspace) {
      setCreateWorkspaceOpen(true);
      return;
    }

    try {
      const result = await createPage.mutateAsync({ title: "Untitled", parentId: null });
      navigate(`/workspace/${primaryWorkspace.id}/page/${result.data.page.id}`);
    } catch {
      toast.error("Could not create a document");
    }
  };

  const inviteMembers = () => {
    if (!primaryWorkspace) {
      setCreateWorkspaceOpen(true);
      return;
    }
    navigate(`/workspace/${primaryWorkspace.id}/members`);
  };

  const stats = [
    { label: "Documents", value: documentCount, icon: FileText, detail: "Across all workspaces" },
    { label: "Workspaces", value: data.workspaces.length, icon: FolderKanban, detail: "Available to you" },
    { label: "Team seats", value: teamSeats, icon: UsersRound, detail: "Across memberships" },
    { label: "Recent changes", value: data.activity.length, icon: Activity, detail: "In your activity feed" },
  ];

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-10">
      <Reveal>
        <section className="relative overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-panel)] sm:p-8 lg:p-10">
          <div className="absolute inset-y-0 right-0 hidden w-[40%] lg:block">
            <div className="absolute right-16 top-10 h-44 w-56 rotate-3 rounded-2xl border border-[var(--border)] bg-[var(--secondary)] p-4 shadow-2xl">
              <div className="h-2 w-16 rounded-full bg-[var(--brand)]" />
              <div className="mt-5 h-3 w-4/5 rounded-full bg-[var(--foreground)]/15" />
              <div className="mt-3 h-2 w-full rounded-full bg-[var(--muted-foreground)]/15" />
              <div className="mt-2 h-2 w-3/4 rounded-full bg-[var(--muted-foreground)]/15" />
              <div className="mt-6 flex gap-2"><span className="size-7 rounded-full bg-[var(--brand)]/70" /><span className="size-7 rounded-full bg-[var(--muted-foreground)]/50" /><span className="grid size-7 place-items-center rounded-full border border-[var(--border)] text-[10px] text-[var(--muted-foreground)]">+3</span></div>
            </div>
            <div className="absolute bottom-8 right-56 h-24 w-40 -rotate-6 rounded-xl border border-[var(--border)] bg-[var(--background)]/80 p-4 shadow-xl">
              <div className="flex items-center gap-2 text-xs font-medium"><span className="size-2 rounded-full bg-[var(--brand)]" /> Synced</div>
              <div className="mt-4 h-2 w-full rounded-full bg-[var(--border)]" />
              <div className="mt-2 h-2 w-2/3 rounded-full bg-[var(--border)]" />
            </div>
          </div>
          <div className="relative max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--brand)]">Welcome back, {user?.name.split(/\s+/)[0] ?? "there"}</p>
            <h1 className="mt-4 text-3xl font-semibold tracking-[-0.045em] text-[var(--foreground)] sm:text-5xl">Your team&apos;s collaborative workspace</h1>
            <p className="mt-4 max-w-xl text-sm leading-7 text-[var(--muted-foreground)] sm:text-base">Create, organize, and shape ideas together with documents that stay in sync across your team.</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button size="lg" onClick={() => void createDocument()} disabled={createPage.isPending}>
                <FilePlus2 className="size-4" /> {createPage.isPending ? "Creating…" : "New document"}
              </Button>
              <Button size="lg" variant="secondary" onClick={inviteMembers}><UsersRound className="size-4" /> Invite members</Button>
            </div>
          </div>
        </section>
      </Reveal>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Workspace statistics">
        {stats.map((stat, index) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }}>
            <Card className="h-full p-5">
              <div className="flex items-start justify-between gap-4">
                <div><p className="text-sm text-[var(--muted-foreground)]">{stat.label}</p><p className="mt-2 text-3xl font-semibold tracking-[-0.04em]">{stat.value}</p></div>
                <span className="grid size-10 place-items-center rounded-xl border border-[var(--border)] bg-[var(--brand-soft)] text-[var(--brand)]"><stat.icon className="size-4" /></span>
              </div>
              <p className="mt-3 text-xs text-[var(--muted-foreground)]">{stat.detail}</p>
            </Card>
          </motion.div>
        ))}
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(300px,0.55fr)]">
        <div className="space-y-8">
          <section>
            <div className="mb-4 flex items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--brand)]">Pick up where you left off</p><h2 className="mt-1 text-xl font-semibold">Continue editing</h2></div></div>
            {continuePage ? (
              <Card className="group overflow-hidden p-0">
                <Link to={`/workspace/${continuePage.workspaceId}/page/${continuePage.id}`} className="grid min-h-44 gap-0 sm:grid-cols-[minmax(0,1fr)_190px]">
                  <div className="flex flex-col p-6">
                    <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl border border-[var(--border)] bg-[var(--surface-subtle)] text-lg">{continuePage.icon ?? <FileText className="size-4 text-[var(--brand)]" />}</span><span className="text-xs text-[var(--muted-foreground)]">{continuePage.workspace.name}</span></div>
                    <h3 className="mt-5 text-xl font-semibold tracking-[-0.025em]">{continuePage.title}</h3>
                    <p className="mt-2 flex items-center gap-1.5 text-xs text-[var(--muted-foreground)]"><Clock3 className="size-3.5" /> Updated {formatUpdatedAt(continuePage.updatedAt)}</p>
                    <span className="mt-auto inline-flex items-center gap-2 pt-5 text-sm font-medium text-[var(--brand)]">Open document <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" /></span>
                  </div>
                  <div className="relative hidden border-l border-[var(--border)] bg-[var(--surface-subtle)] p-5 sm:block">
                    <div className="h-2 w-16 rounded-full bg-[var(--brand)]" /><div className="mt-6 h-3 w-5/6 rounded-full bg-[var(--foreground)]/15" /><div className="mt-3 h-2 w-full rounded-full bg-[var(--muted-foreground)]/15" /><div className="mt-2 h-2 w-4/5 rounded-full bg-[var(--muted-foreground)]/15" /><div className="mt-7 h-10 rounded-lg border border-[var(--border)] bg-[var(--background)]/40" />
                  </div>
                </Link>
              </Card>
            ) : (
              <Card className="grid min-h-44 place-items-center p-8 text-center"><div><FilePlus2 className="mx-auto size-6 text-[var(--brand)]" /><h3 className="mt-3 font-medium">No documents yet</h3><p className="mt-1 text-sm text-[var(--muted-foreground)]">Create a workspace and your first shared document.</p><Button className="mt-5" onClick={() => void createDocument()}><Plus className="size-4" /> Get started</Button></div></Card>
            )}
          </section>

          <section>
            <div className="mb-4 flex items-end justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--brand)]">Recently opened</p><h2 className="mt-1 text-xl font-semibold">Recent documents</h2></div>{primaryWorkspace && <Button asChild variant="ghost" size="sm"><Link to={`/workspace/${primaryWorkspace.id}`}>View workspace <ArrowRight className="size-4" /></Link></Button>}</div>
            <Card className="overflow-hidden p-0">
              {data.recentPages.length ? data.recentPages.slice(0, 6).map((page, index) => (
                <Link key={page.id} to={`/workspace/${page.workspaceId}/page/${page.id}`} className="group flex items-center gap-4 border-b border-[var(--border)] px-4 py-4 transition-colors last:border-b-0 hover:bg-[var(--surface-subtle)] sm:px-5">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-[var(--border)] bg-[var(--surface-subtle)] text-sm">{page.icon ?? <FileText className="size-4 text-[var(--brand)]" />}</span>
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{page.title}</p><p className="mt-1 truncate text-xs text-[var(--muted-foreground)]">{page.workspace.name}</p></div>
                  <span className="hidden text-xs text-[var(--muted-foreground)] sm:block">{formatUpdatedAt(page.updatedAt)}</span>
                  <ArrowRight className="size-4 text-[var(--muted-foreground)] transition group-hover:translate-x-1 group-hover:text-[var(--brand)]" />
                </Link>
              )) : <div className="p-8 text-center text-sm text-[var(--muted-foreground)]">Your recently opened documents will appear here.</div>}
            </Card>
          </section>
        </div>

        <aside className="space-y-6">
          <section><div className="mb-4"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--brand)]">Shortcuts</p><h2 className="mt-1 text-xl font-semibold">Quick actions</h2></div><Card className="p-2">
            <Button variant="ghost" className="w-full justify-start" onClick={() => void createDocument()} disabled={createPage.isPending}><FilePlus2 className="size-4 text-[var(--brand)]" /> Create document</Button>
            <Button variant="ghost" className="w-full justify-start" onClick={() => setCreateWorkspaceOpen(true)}><FolderKanban className="size-4 text-[var(--brand)]" /> Create workspace</Button>
            <Button variant="ghost" className="w-full justify-start" onClick={inviteMembers}><UsersRound className="size-4 text-[var(--brand)]" /> Invite a member</Button>
            {continuePage && <Button asChild variant="ghost" className="w-full justify-start"><Link to={`/workspace/${continuePage.workspaceId}/page/${continuePage.id}?history=1`}><FileClock className="size-4 text-[var(--brand)]" /> View version history</Link></Button>}
          </Card></section>

          <section><div className="mb-4"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--brand)]">Team updates</p><h2 className="mt-1 text-xl font-semibold">Activity</h2></div><Card className="p-2"><ActivityFeed items={data.activity.slice(0, 7)} /></Card></section>
        </aside>
      </div>
      <CreateWorkspaceDialog open={createWorkspaceOpen} onOpenChange={setCreateWorkspaceOpen} />
    </div>
  );
}
