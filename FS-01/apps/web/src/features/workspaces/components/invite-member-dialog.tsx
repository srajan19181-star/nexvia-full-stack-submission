import { useState, type FormEvent } from "react";
import { inviteMemberInputSchema } from "@nexvia/shared";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { ApiError } from "@/lib/api-client";
import { useInviteMember } from "../queries";

const selectClass = "min-h-11 w-full rounded-xl border border-[var(--glass-border)] bg-[var(--glass)] px-3 text-sm outline-none focus:border-[var(--brand-cyan)] focus:ring-4 focus:ring-[color-mix(in_oklab,var(--brand-cyan)_14%,transparent)]";

export function InviteMemberDialog({ workspaceId, open, onOpenChange }: { workspaceId: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const mutation = useInviteMember(workspaceId);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);
    const parsed = inviteMemberInputSchema.safeParse({
      email: form.get("email"),
      workspaceRole: form.get("workspaceRole"),
      contentRole: form.get("contentRole"),
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Review the invitation details");
      return;
    }
    try {
      await mutation.mutateAsync(parsed.data);
      toast.success(`Invitation sent to ${parsed.data.email}`);
      onOpenChange(false);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Could not send the invitation");
    }
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Invite a collaborator" description="Access is private by default. Choose the minimum role this person needs.">
      <form onSubmit={(event) => void submit(event)} className="space-y-5">
        <div className="space-y-2"><Label htmlFor="invite-email">Email address</Label><Input id="invite-email" name="email" type="email" placeholder="teammate@company.com" required /></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2"><Label htmlFor="workspace-role">Workspace role</Label><select id="workspace-role" name="workspaceRole" className={selectClass} defaultValue="MEMBER"><option value="MEMBER">Member</option><option value="ADMIN">Admin</option></select></div>
          <div className="space-y-2"><Label htmlFor="content-role">Content access</Label><select id="content-role" name="contentRole" className={selectClass} defaultValue="EDITOR"><option value="EDITOR">Editor</option><option value="COMMENTER">Commenter</option><option value="VIEWER">Viewer</option></select></div>
        </div>
        {error && <p role="alert" className="text-sm text-[var(--danger)]">{error}</p>}
        <div className="flex justify-end gap-3"><Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? "Sending…" : "Send invitation"}</Button></div>
      </form>
    </Modal>
  );
}
