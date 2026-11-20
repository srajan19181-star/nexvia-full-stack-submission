import { motion, useMotionValue, useReducedMotion, useSpring } from "motion/react";
import type { PointerEvent, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function SpatialCard({ children, className, intensity = 7 }: { children: ReactNode; className?: string; intensity?: number }) {
  const reducedMotion = useReducedMotion();
  const rotateX = useSpring(useMotionValue(0), { stiffness: 180, damping: 22 });
  const rotateY = useSpring(useMotionValue(0), { stiffness: 180, damping: 22 });

  const move = (event: PointerEvent<HTMLDivElement>) => {
    if (reducedMotion || !window.matchMedia("(pointer: fine)").matches) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width;
    const y = (event.clientY - bounds.top) / bounds.height;
    rotateX.set((0.5 - y) * intensity);
    rotateY.set((x - 0.5) * intensity);
    event.currentTarget.style.setProperty("--pointer-x", `${x * 100}%`);
    event.currentTarget.style.setProperty("--pointer-y", `${y * 100}%`);
  };

  const reset = () => {
    rotateX.set(0);
    rotateY.set(0);
  };

  return (
    <motion.div
      className={cn("spatial-card preserve-3d", className)}
      style={{ rotateX, rotateY, transformPerspective: 1_000 }}
      onPointerMove={move}
      onPointerLeave={reset}
      {...(reducedMotion ? {} : { whileHover: { y: -5 } })}
      transition={{ type: "spring", stiffness: 240, damping: 24 }}
    >
      {children}
    </motion.div>
  );
}
