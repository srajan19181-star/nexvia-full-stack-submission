import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "group relative inline-flex min-h-10 shrink-0 items-center justify-center gap-2 overflow-hidden rounded-xl px-4 text-sm font-semibold transition-[background-color,color,border-color,box-shadow,transform] duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] disabled:pointer-events-none disabled:opacity-50 active:translate-y-px",
  {
    variants: {
      variant: {
        primary:
          "border border-[color-mix(in_oklab,var(--brand)_72%,white)] bg-[var(--brand)] text-[#0b1220] shadow-[0_12px_30px_-18px_var(--glow-cyan)] hover:-translate-y-0.5 hover:bg-[#63ded2] hover:shadow-[0_16px_34px_-18px_var(--glow-cyan)]",
        secondary:
          "border border-[var(--glass-border)] bg-[var(--glass)] text-[var(--foreground)] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_10px_30px_-22px_rgba(65,171,255,0.6)] backdrop-blur-xl hover:-translate-y-0.5 hover:border-[var(--glass-border-strong)] hover:bg-[var(--glass-hover)]",
        ghost: "text-[var(--muted-foreground)] hover:bg-[var(--glass-hover)] hover:text-[var(--foreground)]",
        danger: "border border-white/10 bg-[var(--danger)] text-white shadow-[0_12px_30px_-18px_var(--danger)] hover:-translate-y-0.5 hover:brightness-105",
      },
      size: {
        sm: "min-h-9 rounded-lg px-3 text-xs",
        md: "min-h-10 px-4",
        lg: "min-h-12 rounded-2xl px-6 text-[15px]",
        icon: "size-10 p-0",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Component = asChild ? Slot : "button";
  return <Component className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
