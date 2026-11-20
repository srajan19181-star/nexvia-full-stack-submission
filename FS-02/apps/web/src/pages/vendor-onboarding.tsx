import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Check, Store } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button, Field, SectionTitle } from "../components/ui";
import { post } from "../lib/api";
import { Protected } from "./customer";

const steps = ["Store profile", "Legal details", "Review"];

export default function VendorOnboardingPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ storeName: "", slug: "", description: "", legalName: "", taxIdentifier: "" });
  const apply = useMutation({
    mutationFn: () => post("/vendors/apply", form),
    onSuccess: () => { toast.success("Application submitted for administrator review"); navigate("/vendor-portal", { replace: true }); location.reload(); },
    onError: (error: Error) => toast.error(error.message),
  });
  const storeReady = form.storeName.length >= 3 && form.description.length >= 30 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.slug);
  const legalReady = form.legalName.length >= 2 && form.taxIdentifier.length >= 4;

  return <Protected><div className="container-shell max-w-4xl py-14"><SectionTitle eyebrow="Sell with AUREVA" title="Build a considered storefront" description="Every maker is reviewed before products can become publicly available." />
    <ol className="mb-8 grid grid-cols-3 gap-2" aria-label="Onboarding progress">{steps.map((label, index) => <li className={`rounded-[5px] border p-3 text-sm ${index <= step ? "border-[var(--olive)] bg-[var(--ivory)]" : "border-[var(--border)] text-[var(--muted)]"}`} key={label}><span className="mr-2 inline-grid size-6 place-items-center rounded-full bg-[var(--surface)] text-xs">{index < step ? <Check size={14} /> : index + 1}</span>{label}</li>)}</ol>
    <div className="card p-7">
      {step === 0 && <div className="grid gap-5"><div><Store className="text-[var(--olive)]" /><h2 className="mt-3 font-editorial text-4xl">Introduce your studio</h2><p className="mt-2 text-sm text-[var(--muted)]">This story appears on your public maker storefront after approval.</p></div><Field label="Store name"><input className="input" value={form.storeName} onChange={(event) => setForm({ ...form, storeName: event.target.value, slug: event.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") })} required /></Field><Field label="Store URL"><div className="flex items-center rounded-[5px] border border-[var(--border)] bg-[var(--ivory)] pl-3 text-sm text-[var(--muted)]"><span>/vendor/</span><input className="min-h-11 min-w-0 flex-1 border-0 bg-transparent px-1 text-[var(--charcoal)] outline-none" value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value.toLowerCase() })} /></div></Field><Field label="Store story"><textarea className="input min-h-40" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} required /></Field><Button disabled={!storeReady} onClick={() => setStep(1)}>Continue</Button></div>}
      {step === 1 && <div className="grid gap-5"><div><h2 className="font-editorial text-4xl">Business identity</h2><p className="mt-2 text-sm text-[var(--muted)]">Demo identifiers are acceptable only in seeded development. Production onboarding requires provider and jurisdiction review.</p></div><Field label="Legal business name"><input className="input" value={form.legalName} onChange={(event) => setForm({ ...form, legalName: event.target.value })} required /></Field><Field label="Tax or registration identifier"><input className="input" value={form.taxIdentifier} onChange={(event) => setForm({ ...form, taxIdentifier: event.target.value })} required /></Field><div className="flex justify-between"><Button variant="secondary" onClick={() => setStep(0)}>Back</Button><Button disabled={!legalReady} onClick={() => setStep(2)}>Review application</Button></div></div>}
      {step === 2 && <div><h2 className="font-editorial text-4xl">Review before submitting</h2><dl className="my-7 divide-y divide-[var(--border)]">{[["Store", form.storeName], ["Public path", `/vendor/${form.slug}`], ["Legal name", form.legalName], ["Identifier", form.taxIdentifier], ["Story", form.description]].map(([label, value]) => <div className="grid gap-2 py-4 sm:grid-cols-[150px_1fr]" key={label}><dt className="text-sm text-[var(--muted)]">{label}</dt><dd className="text-sm font-semibold">{value}</dd></div>)}</dl><p className="mb-6 rounded-[5px] bg-[var(--surface)] p-4 text-sm">Submitting creates a pending vendor profile. Product publication remains blocked until an administrator approves the application.</p><div className="flex justify-between"><Button variant="secondary" onClick={() => setStep(1)}>Back</Button><Button variant="olive" disabled={apply.isPending} onClick={() => apply.mutate()}>{apply.isPending ? "Submitting…" : "Submit for review"}</Button></div></div>}
    </div>
  </div></Protected>;
}
