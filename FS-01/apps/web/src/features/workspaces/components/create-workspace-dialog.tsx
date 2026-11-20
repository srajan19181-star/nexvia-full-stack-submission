import { useId, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { createWorkspaceInputSchema } from "@nexvia/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { ApiError } from "@/lib/api-client";
import { useCreateWorkspace } from "../queries";

export function CreateWorkspaceDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const mutation = useCreateWorkspace();
  const navigate = useNavigate();
  const nameInputId = useId();
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const parsed = createWorkspaceInputSchema.safeParse({ name: new FormData(event.currentTarget).get("name") });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Enter a workspace name");
      return;
    }
    try {
      const result = await mutation.mutateAsync(parsed.data);
      onOpenChange(false);
      navigate(`/workspace/${result.data.workspace.id}`);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Could not create the workspace");
    }
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Create a workspace" description="Give your team a focused home for pages, decisions, and shared context.">
      <form onSubmit={(event) => void submit(event)} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor={nameInputId}>Workspace name</Label>
          <Input id={nameInputId} name="name" autoFocus placeholder="Product & design" maxLength={80} required />
          <p className="text-xs text-[var(--muted-foreground)]">You can rename it later in workspace settings.</p>
        </div>
        {error && <p role="alert" className="text-sm text-[var(--danger)]">{error}</p>}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? "Creating…" : "Create workspace"}</Button>
        </div>
      </form>
    </Modal>
  );
}
