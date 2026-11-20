import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { motion, useReducedMotion } from "motion/react";
import {
  ArrowRight,
  Check,
  FileClock,
  FolderKanban,
  LockKeyhole,
  MessageSquareText,
  MousePointer2,
  Radio,
  ShieldCheck,
  UsersRound,
  Workflow,
} from "lucide-react";
import { Link } from "react-router-dom";
import { MarketingHeader } from "@/components/layout/marketing-header";
import { Magnetic } from "@/components/spatial/magnetic";
import { Reveal } from "@/components/spatial/reveal";
import { SpatialBackground } from "@/components/spatial/spatial-background";
import { SpatialCard } from "@/components/spatial/spatial-card";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useDocumentTitle } from "@/lib/use-document-title";

const SpatialHeroScene = lazy(() => import("@/features/marketing/spatial-hero-scene"));

const features = [
  {
    icon: Radio,
    title: "Real-time Collaboration",
    description: "Edit together, see changes instantly, and never lose context.",
  },
  {
    icon: FolderKanban,
    title: "Organize Your Work",
    description: "Workspaces, pages, and projects to keep everything in place.",
  },
  {
    icon: ShieldCheck,
    title: "Control & Privacy",
    description: "Granular permissions, secure access, and version history built in.",
  },
  {
    icon: FileClock,
    title: "Version History",
    description: "Track changes, compare versions, and restore anytime.",
  },
];

function useSpatialScene() {
  const reducedMotion = useReducedMotion();
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (import.meta.env.MODE === "test" || reducedMotion || window.innerWidth < 900) return;
    const canvas = document.createElement("canvas");
    setEnabled(Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl")));
  }, [reducedMotion]);

  return enabled;
}

function SceneFallback() {
  return (
    <div className="relative flex h-full items-center justify-center px-2 sm:px-8">
      <div className="absolute left-1/2 top-1/2 h-[72%] w-[82%] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border border-[var(--glass-border)] opacity-60 [transform:translate(-50%,-50%)_rotateX(68deg)]" />
      <div className="absolute left-1/2 top-[73%] h-24 w-3/5 -translate-x-1/2 rounded-full bg-[var(--glow-cyan)] opacity-30 blur-[55px]" />

      <div className="glass-panel relative z-10 w-full max-w-xl -rotate-1 rounded-2xl border border-[var(--glass-border-strong)] bg-[var(--glass-strong)] p-3 shadow-[0_36px_90px_-44px_var(--glow-cyan)] backdrop-blur-2xl">
        <div className="flex items-center gap-2 border-b border-[var(--glass-border)] px-2 pb-3">
          <span className="size-2 rounded-full bg-[var(--brand)]" />
          <span className="size-2 rounded-full bg-[var(--muted-foreground)]/50" />
          <span className="size-2 rounded-full bg-[var(--muted-foreground)]/25" />
          <span className="ml-auto flex items-center gap-1.5 rounded-full border border-[var(--glass-border)] px-2.5 py-1 text-[9px] text-[var(--muted-foreground)]"><Radio className="size-2.5 text-[var(--brand)]" /> Live document</span>
        </div>
        <div className="grid min-h-72 grid-cols-[4.5rem_1fr] gap-4 p-4 sm:grid-cols-[8rem_1fr]">
          <div className="space-y-3 border-r border-[var(--glass-border)] pr-3">
            {[82, 64, 76, 55].map((width, index) => <span key={width} className="block h-2 rounded-full bg-[var(--surface-hover)]" style={{ width: `${width}%`, opacity: 1 - index * 0.12 }} />)}
          </div>
          <div className="relative pt-2">
            <div className="h-3 w-3/5 rounded-full bg-[var(--foreground)]/80" />
            <div className="mt-5 space-y-3">{[94, 82, 88, 64].map((width) => <div key={width} className="h-2 rounded-full bg-[var(--muted-foreground)]/25" style={{ width: `${width}%` }} />)}</div>
            <div className="mt-8 rounded-xl border border-[var(--glass-border)] bg-[var(--brand-soft)] p-4"><div className="h-2 w-1/3 rounded-full bg-[var(--brand)]/70" /><div className="mt-3 h-2 w-4/5 rounded-full bg-[var(--muted-foreground)]/20" /></div>
            <span className="absolute right-[14%] top-[34%] h-5 border-l-2 border-[var(--brand)]"><span className="absolute -top-5 left-0 rounded-md bg-[var(--brand)] px-1.5 py-0.5 text-[8px] font-semibold text-[#0b1220]">Maya</span></span>
          </div>
        </div>
      </div>

      <div className="glass-panel absolute left-0 top-[18%] z-20 hidden w-40 rounded-xl border border-[var(--glass-border)] bg-[var(--glass)] p-3 shadow-[var(--shadow-panel)] backdrop-blur-xl sm:block">
        <div className="flex items-center gap-2"><MessageSquareText className="size-3.5 text-[var(--brand)]" /><span className="text-[10px] font-semibold">New comment</span></div>
        <p className="mt-2 text-[9px] leading-4 text-[var(--muted-foreground)]">Let&apos;s move this into the launch section.</p>
      </div>
      <div className="glass-panel absolute bottom-[16%] right-0 z-20 hidden rounded-xl border border-[var(--glass-border)] bg-[var(--glass)] p-3 shadow-[var(--shadow-panel)] backdrop-blur-xl sm:block">
        <div className="flex items-center gap-2 text-[10px]"><Check className="size-3.5 text-[var(--brand)]" /> All changes saved</div>
      </div>
      <div className="absolute right-[16%] top-[16%] z-20 hidden items-start gap-1 text-[var(--brand)] md:flex"><MousePointer2 className="size-4 fill-current" /><span className="rounded bg-[var(--brand)] px-1.5 py-0.5 text-[8px] font-semibold text-[#0b1220]">Live</span></div>
    </div>
  );
}

export function LandingPage() {
  useDocumentTitle("Where ideas move together");
  const reducedMotion = useReducedMotion();
  const sceneEnabled = useSpatialScene();
  const heroRef = useRef<HTMLElement>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  const scrollProgress = useRef(0);

  useEffect(() => {
    if (import.meta.env.MODE === "test" || reducedMotion || !heroRef.current || !sceneRef.current) return;
    gsap.registerPlugin(ScrollTrigger);
    const animation = gsap.to(sceneRef.current, {
      yPercent: -6,
      scale: 0.97,
      ease: "none",
      scrollTrigger: {
        trigger: heroRef.current,
        start: "top top",
        end: "bottom top",
        scrub: 0.7,
        onUpdate: (self) => { scrollProgress.current = self.progress; },
      },
    });
    return () => {
      animation.scrollTrigger?.kill();
      animation.kill();
    };
  }, [reducedMotion]);

  return (
    <div className="relative overflow-hidden bg-[var(--background)]">
      <SpatialBackground className="fixed" />
      <MarketingHeader />
      <main className="relative z-10">
        <section ref={heroRef} className="relative px-4 pb-20 pt-28 sm:px-6 sm:pt-32 lg:min-h-[48rem] lg:px-8 lg:pb-24 lg:pt-36">
          <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[0.88fr_1.12fr] lg:gap-8">
            <motion.div
              initial={reducedMotion ? false : { opacity: 0, x: -24 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
              className="relative z-20"
            >
              <span className="inline-flex items-center gap-2 rounded-full border border-[var(--glass-border)] bg-[var(--glass)] px-3.5 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--brand)] backdrop-blur-xl">
                <Radio className="size-3" /> Real-time collaborative workspace
              </span>
              <h1 aria-label="Work beautifully, together." className="mt-7 text-balance text-5xl font-semibold leading-[0.98] tracking-[-0.06em] sm:text-7xl lg:text-[5.15rem]">
                Work beautifully,
                <span className="block text-[var(--brand)]">together.</span>
              </h1>
              <p className="mt-7 max-w-xl text-base leading-7 text-[var(--muted-foreground)] sm:text-lg sm:leading-8">
                Create, edit, discuss, and build ideas with your team in one intelligent, real-time workspace.
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Magnetic><Button size="lg" asChild><Link to="/register">Create your workspace <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" /></Link></Button></Magnetic>
                <Button size="lg" variant="secondary" asChild><a href="#product">Explore workspace</a></Button>
              </div>
              <div className="mt-7 flex flex-wrap gap-x-5 gap-y-3 text-xs text-[var(--muted-foreground)]">
                <span className="flex items-center gap-1.5"><Radio className="size-3.5 text-[var(--brand)]" /> Real-time sync</span>
                <span className="flex items-center gap-1.5"><ShieldCheck className="size-3.5 text-[var(--brand)]" /> Secure by design</span>
                <span className="flex items-center gap-1.5"><UsersRound className="size-3.5 text-[var(--brand)]" /> Built for teams</span>
              </div>
            </motion.div>

            <motion.div
              ref={sceneRef}
              className="relative h-[29rem] min-w-0 sm:h-[34rem] lg:h-[38rem]"
              initial={reducedMotion ? false : { opacity: 0, x: 28, scale: 0.97 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              transition={{ duration: 0.9, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
            >
              {sceneEnabled ? <Suspense fallback={<SceneFallback />}><SpatialHeroScene progress={scrollProgress} /></Suspense> : <SceneFallback />}
            </motion.div>
          </div>
        </section>

        <section id="product" className="border-y border-[var(--glass-border)] bg-[color-mix(in_oklab,var(--surface-subtle)_64%,transparent)] px-4 py-24 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <Reveal className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--brand)]">Everything stays connected</p>
              <h2 className="mt-4 text-balance text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">One place for the work around the work.</h2>
              <p className="mt-4 text-base leading-7 text-[var(--muted-foreground)]">Move from an early thought to an aligned decision without losing the people, feedback, or history around it.</p>
            </Reveal>
            <div className="mt-12 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {features.map((feature, index) => (
                <Reveal key={feature.title} delay={index * 0.06}>
                  <SpatialCard className="h-full rounded-2xl" intensity={4}>
                    <Card className="h-full p-6">
                      <span className="grid size-11 place-items-center rounded-xl border border-[var(--glass-border)] bg-[var(--brand-soft)] text-[var(--brand)]"><feature.icon className="size-5" /></span>
                      <h3 className="mt-8 text-lg font-semibold tracking-[-0.025em]">{feature.title}</h3>
                      <p className="mt-3 text-sm leading-6 text-[var(--muted-foreground)]">{feature.description}</p>
                    </Card>
                  </SpatialCard>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section id="workflow" className="px-4 py-24 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-[0.9fr_1.1fr]">
            <Reveal>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--brand)]">How it works</p>
              <h2 className="mt-4 text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">A calmer path from draft to done.</h2>
              <p className="mt-5 max-w-xl text-base leading-7 text-[var(--muted-foreground)]">Create a focused workspace, invite the right people, and collaborate in a document that stays synchronized and recoverable.</p>
            </Reveal>
            <Reveal delay={0.08} className="space-y-3">
              {[
                ["01", "Create your workspace", "Give projects and pages a shared home."],
                ["02", "Build together", "Edit, comment, and see presence in real time."],
                ["03", "Keep the full story", "Review activity and safely restore prior versions."],
              ].map(([number, title, description]) => (
                <div key={number} className="flex gap-4 rounded-2xl border border-[var(--glass-border)] bg-[var(--glass)] p-5 backdrop-blur-xl">
                  <span className="font-mono text-xs text-[var(--brand)]">{number}</span>
                  <div><h3 className="font-semibold">{title}</h3><p className="mt-1 text-sm text-[var(--muted-foreground)]">{description}</p></div>
                </div>
              ))}
            </Reveal>
          </div>
        </section>

        <section id="security" className="px-4 pb-28 sm:px-6 lg:px-8">
          <Reveal className="mx-auto max-w-7xl rounded-3xl border border-[var(--glass-border)] bg-[var(--surface)] p-7 shadow-[var(--shadow-panel)] sm:p-10 lg:flex lg:items-center lg:justify-between lg:gap-10">
            <div className="max-w-2xl">
              <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--brand)]"><LockKeyhole className="size-4" /> Secure by design</span>
              <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">Private collaboration without hidden compromises.</h2>
              <p className="mt-4 text-sm leading-7 text-[var(--muted-foreground)]">Orvyn enforces identity, permissions, and document access across REST and live collaboration while keeping durable history in PostgreSQL.</p>
            </div>
            <div className="mt-8 flex flex-wrap gap-2 lg:mt-0 lg:max-w-sm lg:justify-end">
              {["HttpOnly sessions", "Role-aware sockets", "Durable Yjs state", "Auditable restores"].map((label) => <span key={label} className="rounded-full border border-[var(--glass-border)] bg-[var(--surface-subtle)] px-3 py-2 text-xs text-[var(--muted-foreground)]">{label}</span>)}
            </div>
          </Reveal>
        </section>

        <section className="border-t border-[var(--glass-border)] px-4 py-20 text-center sm:px-6">
          <Reveal className="mx-auto max-w-3xl">
            <Workflow className="mx-auto size-6 text-[var(--brand)]" />
            <h2 className="mt-5 text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">Where ideas move together.</h2>
            <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-[var(--muted-foreground)]">Start a private workspace and invite your team when the work is ready to move.</p>
            <div className="mt-8"><Magnetic><Button size="lg" asChild><Link to="/register">Start free <ArrowRight className="size-4" /></Link></Button></Magnetic></div>
          </Reveal>
        </section>
      </main>
      <footer className="relative z-10 border-t border-[var(--glass-border)] px-4 py-8 text-center text-xs text-[var(--muted-foreground)]">© {new Date().getFullYear()} Orvyn. Where ideas move together.</footer>
    </div>
  );
}
