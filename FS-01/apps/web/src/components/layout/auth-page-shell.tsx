import { CheckCircle2, Radio, Sparkles } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";
import { SpatialBackground } from "@/components/spatial/spatial-background";
import { useDocumentTitle } from "@/lib/use-document-title";
import { Logo } from "./logo";
import { ThemeToggle } from "./theme-toggle";

export function AuthPageShell({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  const reducedMotion = useReducedMotion();
  useDocumentTitle(title);

  return (
    <main className="relative grid min-h-screen overflow-hidden bg-[var(--background)] lg:grid-cols-[minmax(0,1.08fr)_minmax(440px,0.92fr)]">
      <SpatialBackground className="fixed" />

      <section className="relative z-10 hidden overflow-hidden border-r border-[var(--glass-border)] p-10 lg:flex lg:flex-col xl:p-14">
        <Logo className="relative z-10" />
        <div className="relative z-10 my-auto max-w-xl">
          <motion.span
            initial={reducedMotion ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 rounded-full border border-[var(--glass-border)] bg-[var(--glass)] px-3 py-1.5 text-xs font-medium text-[var(--brand-cyan)] backdrop-blur-xl"
          >
            <Sparkles className="size-3.5" /> A calmer place to build together
          </motion.span>
          <motion.h1
            initial={reducedMotion ? false : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            className="mt-7 text-5xl font-semibold leading-[1.03] tracking-[-0.055em] xl:text-7xl"
          >
            Shared thinking,
            <br /><span className="text-[var(--brand)]">without the noise.</span>
          </motion.h1>
          <motion.p
            initial={reducedMotion ? false : { opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.14 }}
            className="mt-6 max-w-lg text-lg leading-8 text-[var(--muted-foreground)]"
          >
            Bring documents, decisions, and teammates into one focused workspace built for live collaboration.
          </motion.p>
          <motion.ul
            initial={reducedMotion ? false : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-10 grid gap-3 text-sm text-[var(--muted-foreground)] sm:grid-cols-2"
          >
            {["Fast, focused writing", "Clear member permissions", "Durable document history", "Secure cookie sessions"].map((item) => (
              <li key={item} className="flex items-center gap-2.5 rounded-xl border border-[var(--glass-border)] bg-[var(--glass)] px-3 py-2.5 backdrop-blur-xl">
                <CheckCircle2 className="size-4 text-[var(--success)]" /> {item}
              </li>
            ))}
          </motion.ul>
        </div>

        <motion.div
          aria-hidden
          className="absolute right-[-6rem] top-[18%] hidden h-52 w-72 rotate-[7deg] rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xl xl:block"
          {...(reducedMotion ? {} : { animate: { y: [0, -12, 0], rotate: [7, 5, 7] } })}
          transition={{ duration: 7, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
        >
          <div className="h-3 w-28 rounded-full bg-[var(--brand-soft)]" />
          <div className="mt-7 space-y-3"><div className="h-2 w-full rounded-full bg-[var(--glass-border)]" /><div className="h-2 w-4/5 rounded-full bg-[var(--glass-border)]" /><div className="h-2 w-2/3 rounded-full bg-[var(--glass-border)]" /></div>
          <div className="mt-7 flex -space-x-2"><span className="size-8 rounded-full border-2 border-[var(--surface)] bg-[var(--brand)]" /><span className="size-8 rounded-full border-2 border-[var(--surface)] bg-[var(--muted-foreground)]" /><span className="size-8 rounded-full border-2 border-[var(--surface)] bg-[var(--brand-strong)]" /></div>
        </motion.div>

        <p className="relative z-10 flex items-center gap-2 text-xs text-[var(--muted-foreground)]"><Radio className="size-3 text-[var(--success)]" /> Secure collaboration network online</p>
      </section>

      <section className="relative z-10 flex min-h-screen items-center justify-center px-4 py-20 sm:px-8">
        <div className="absolute right-4 top-4"><ThemeToggle /></div>
        <motion.div
          initial={reducedMotion ? false : { opacity: 0, y: 24, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-[470px] rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl sm:p-8"
        >
          <div className="mb-8 lg:hidden"><Logo /></div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--brand-cyan)]">{eyebrow}</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em]">{title}</h2>
          <p className="mt-3 text-sm leading-6 text-[var(--muted-foreground)]">{description}</p>
          <div className="mt-8">{children}</div>
        </motion.div>
      </section>
    </main>
  );
}
