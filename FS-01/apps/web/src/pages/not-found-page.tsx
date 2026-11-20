import { ArrowLeft, Compass } from "lucide-react";
import { Link } from "react-router-dom";
import { Logo } from "@/components/layout/logo";
import { SpatialBackground } from "@/components/spatial/spatial-background";
import { Button } from "@/components/ui/button";
import { useDocumentTitle } from "@/lib/use-document-title";

export function NotFoundPage() {
  useDocumentTitle("Page not found");
  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden px-5 text-center">
      <SpatialBackground className="fixed" />
      <div className="absolute left-6 top-6 z-10"><Logo /></div>
      <div className="relative z-10 max-w-xl rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 shadow-2xl sm:p-12">
        <span className="mx-auto grid size-16 place-items-center rounded-xl border border-[var(--glass-border-strong)] bg-[var(--brand-soft)]"><Compass className="size-7 text-[var(--brand)]" /></span>
        <p className="mt-7 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--brand)]">404 · Page not found</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">This page wandered off.</h1>
        <p className="mt-4 leading-7 text-[var(--muted-foreground)]">The link may be outdated, or you might not have access to this part of the workspace.</p>
        <Button size="lg" className="mt-8" asChild><Link to="/"><ArrowLeft className="size-4" /> Return home</Link></Button>
      </div>
    </main>
  );
}
