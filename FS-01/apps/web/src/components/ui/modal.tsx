import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { Button } from "./button";
import { cn } from "@/lib/utils";

export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: "md" | "xl";
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      onCancel={(event) => {
        event.preventDefault();
        onOpenChange(false);
      }}
      onClose={() => onOpenChange(false)}
      onClick={(event) => {
        if (event.target === event.currentTarget) onOpenChange(false);
      }}
      className={cn(
        "glass-panel m-auto w-[calc(100%-2rem)] overflow-hidden rounded-[1.75rem] border border-[var(--glass-border-strong)] bg-[var(--glass-strong)] p-0 text-[var(--foreground)] shadow-[0_32px_110px_-32px_var(--glow-blue)] backdrop-blur-3xl",
        size === "xl" ? "max-w-5xl" : "max-w-lg",
      )}
      aria-labelledby="modal-title"
      aria-describedby={description ? "modal-description" : undefined}
    >
      <div className="flex items-start gap-4 border-b border-[var(--glass-border)] px-6 py-5">
        <div className="min-w-0 flex-1">
          <h2 id="modal-title" className="text-lg font-semibold tracking-[-0.02em]">{title}</h2>
          {description && <p id="modal-description" className="mt-1 text-sm leading-6 text-[var(--muted-foreground)]">{description}</p>}
        </div>
        <Button type="button" variant="ghost" size="icon" onClick={() => onOpenChange(false)} aria-label="Close dialog">
          <X className="size-4" />
        </Button>
      </div>
      <div className="px-6 py-5">{children}</div>
      {footer && <div className="flex justify-end gap-3 border-t border-[var(--glass-border)] bg-[var(--glass)] px-6 py-4">{footer}</div>}
    </dialog>
  );
}
