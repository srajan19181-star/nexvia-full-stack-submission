import { motion, useMotionValue, useReducedMotion, useSpring } from "motion/react";
import { useEffect, type CSSProperties } from "react";
import { cn } from "@/lib/utils";

const particles = Array.from({ length: 14 }, (_, index) => ({
  left: `${(index * 37 + 11) % 100}%`,
  top: `${(index * 53 + 7) % 100}%`,
  delay: `${-(index % 9) * 0.8}s`,
  duration: `${8 + (index % 6) * 1.7}s`,
  size: `${1 + (index % 3)}px`,
}));

export function SpatialBackground({ className, interactive = true }: { className?: string; interactive?: boolean }) {
  const reducedMotion = useReducedMotion();
  const cursorX = useMotionValue(-500);
  const cursorY = useMotionValue(-500);
  const springX = useSpring(cursorX, { stiffness: 80, damping: 24, mass: 0.35 });
  const springY = useSpring(cursorY, { stiffness: 80, damping: 24, mass: 0.35 });

  useEffect(() => {
    if (!interactive || reducedMotion || !window.matchMedia("(pointer: fine)").matches) return;
    const move = (event: PointerEvent) => {
      cursorX.set(event.clientX - 240);
      cursorY.set(event.clientY - 240);
    };
    window.addEventListener("pointermove", move, { passive: true });
    return () => window.removeEventListener("pointermove", move);
  }, [cursorX, cursorY, interactive, reducedMotion]);

  return (
    <div className={cn("spatial-background pointer-events-none absolute inset-0 overflow-hidden", className)} aria-hidden="true">
      <div className="spatial-grid absolute inset-0" />
      <div className="spatial-orb spatial-orb--cyan absolute -right-44 top-[8%] size-[34rem]" />
      <div className="spatial-orb spatial-orb--blue absolute bottom-[-20rem] left-[28%] size-[28rem]" />
      {particles.map((particle, index) => (
        <span
          key={index}
          className="spatial-particle absolute rounded-full bg-[var(--glow-cyan)]"
          style={{
            left: particle.left,
            top: particle.top,
            width: particle.size,
            height: particle.size,
            "--particle-delay": particle.delay,
            "--particle-duration": particle.duration,
          } as CSSProperties}
        />
      ))}
      {interactive && !reducedMotion && (
        <motion.div
          className="absolute size-[28rem] rounded-full bg-[radial-gradient(circle,rgba(77,201,192,0.1),transparent_68%)] blur-2xl"
          style={{ x: springX, y: springY }}
        />
      )}
      <div className="spatial-vignette absolute inset-0" />
    </div>
  );
}
