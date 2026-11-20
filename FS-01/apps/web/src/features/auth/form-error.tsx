import { AlertCircle } from "lucide-react";

export function FormError({ message }: { message?: string | null }) {
  if (!message) {
    return null;
  }

  return (
    <div role="alert" className="flex gap-2.5 rounded-xl border border-[color-mix(in_oklab,var(--danger)_32%,var(--border))] bg-[color-mix(in_oklab,var(--danger)_8%,var(--surface))] p-3 text-sm text-[var(--danger)]">
      <AlertCircle className="mt-0.5 size-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}
