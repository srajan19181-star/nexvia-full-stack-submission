import { motion, useMotionValue, useReducedMotion, useSpring } from "motion/react";
import type { PointerEvent, ReactNode } from "react";

export function Magnetic({ children, strength = 0.16 }: { children: ReactNode; strength?: number }) {
  const reducedMotion = useReducedMotion();
  const x = useSpring(useMotionValue(0), { stiffness: 260, damping: 20 });
  const y = useSpring(useMotionValue(0), { stiffness: 260, damping: 20 });

  const move = (event: PointerEvent<HTMLSpanElement>) => {
    if (reducedMotion) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    x.set((event.clientX - bounds.left - bounds.width / 2) * strength);
    y.set((event.clientY - bounds.top - bounds.height / 2) * strength);
  };

  const reset = () => {
    x.set(0);
    y.set(0);
  };

  return <motion.span className="inline-flex" style={{ x, y }} onPointerMove={move} onPointerLeave={reset}>{children}</motion.span>;
}
