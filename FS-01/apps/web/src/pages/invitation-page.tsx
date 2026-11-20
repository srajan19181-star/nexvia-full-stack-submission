import { CheckCircle2, Mail, XCircle } from "lucide-react";
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Logo } from "@/components/layout/logo";
import { SpatialBackground } from "@/components/spatial/spatial-background";
import { useInvitationDecision } from "@/features/workspaces/queries";
import { ApiError } from "@/lib/api-client";
import { useDocumentTitle } from "@/lib/use-document-title";

export function InvitationPage() {
  useDocumentTitle("Workspace invitation");
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const decision = useInvitationDecision();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(token ? null : "This invitation link is missing its token.");
  const decide = async (accept: boolean) => {
    setError(null);
    try {
      const response = await decision.mutateAsync({ token, accept });
      if (accept) navigate(`/workspace/${response.data.workspace.id}`, { replace: true });
      else navigate("/dashboard", { replace: true });
    } catch (caught) { setError(caught instanceof ApiError ? caught.message : "Could not process the invitation"); }
  };
  return <main className="relative grid min-h-screen place-items-center overflow-hidden px-5 py-16"><SpatialBackground className="fixed" /><div className="absolute left-6 top-6 z-10"><Logo /></div><Card className="relative z-10 w-full max-w-lg rounded-[2rem] p-8 text-center sm:p-10"><span className="mx-auto grid size-16 place-items-center rounded-2xl border border-[var(--glass-border)] bg-[var(--brand-soft)] text-[var(--brand-cyan)] shadow-[0_18px_50px_-24px_var(--glow-cyan)]"><Mail className="size-7" /></span><p className="mt-6 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--brand-cyan)]">Secure handoff</p><h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">Workspace invitation</h1><p className="mt-3 text-sm leading-6 text-[var(--muted-foreground)]">Accept to add the workspace with the role chosen by its administrator, or decline without changing your account.</p>{error && <p role="alert" className="mt-5 rounded-xl border border-[color-mix(in_oklab,var(--danger)_30%,var(--glass-border))] bg-[color-mix(in_oklab,var(--danger)_8%,var(--glass))] p-3 text-sm text-[var(--danger)]">{error}</p>}<div className="mt-7 flex flex-col gap-3 sm:flex-row"><Button className="flex-1" disabled={!token || decision.isPending} onClick={() => void decide(true)}><CheckCircle2 className="size-4" /> Accept invitation</Button><Button className="flex-1" variant="secondary" disabled={!token || decision.isPending} onClick={() => void decide(false)}><XCircle className="size-4" /> Decline</Button></div></Card></main>;
}
