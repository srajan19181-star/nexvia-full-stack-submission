import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Clock3, ShieldAlert } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { api, post, put, remove } from "../lib/api";
import { Badge, Button, Empty, ErrorState, Field, Loading, SectionTitle } from "../components/ui";
import { Protected } from "./customer";

type Profile = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  emailVerifiedAt: string | null;
  customerProfile: { phone: string | null; dateOfBirth: string | null } | null;
};

type Session = { id: string; ipAddress: string | null; userAgent: string | null; createdAt: string; expiresAt: string };

export function AccountSettings() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const profile = useQuery({ queryKey: ["profile"], queryFn: () => api<Profile>("/users/me/profile") });
  const sessions = useQuery({ queryKey: ["sessions"], queryFn: () => api<Session[]>("/users/me/sessions") });
  const [form, setForm] = useState({ name: "", avatarUrl: "", phone: "", dateOfBirth: "" });
  const [passwords, setPasswords] = useState({ currentPassword: "", newPassword: "" });

  useEffect(() => {
    if (!profile.data) return;
    setForm({
      name: profile.data.name,
      avatarUrl: profile.data.avatarUrl ?? "",
      phone: profile.data.customerProfile?.phone ?? "",
      dateOfBirth: profile.data.customerProfile?.dateOfBirth?.slice(0, 10) ?? "",
    });
  }, [profile.data]);

  const save = useMutation({
    mutationFn: () => put("/users/me/profile", { ...form, avatarUrl: form.avatarUrl || null, phone: form.phone || null, dateOfBirth: form.dateOfBirth || null }),
    onSuccess: () => {
      toast.success("Profile updated");
      void queryClient.invalidateQueries({ queryKey: ["profile"] });
      void queryClient.invalidateQueries({ queryKey: ["me"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const changePassword = useMutation({
    mutationFn: () => post<{ changed: boolean; signInRequired: boolean }>("/users/me/change-password", passwords),
    onSuccess: () => {
      queryClient.clear();
      toast.success("Password changed. Sign in again on your devices.");
      navigate("/login", { replace: true });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const revoke = useMutation({
    mutationFn: (id: string) => remove(`/users/me/sessions/${id}`),
    onSuccess: () => {
      toast.success("Session revoked");
      void queryClient.invalidateQueries({ queryKey: ["sessions"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Protected>
      <div className="container-shell py-14">
        <SectionTitle eyebrow="Account security" title="Profile & preferences" description="Manage your identity, password, and signed-in devices." />
        <div className="grid gap-8 xl:grid-cols-2">
          <form className="card grid gap-4 p-6" onSubmit={(event) => { event.preventDefault(); save.mutate(); }}>
            <div><h2 className="text-lg font-bold">Profile details</h2><p className="mt-1 text-sm text-[var(--muted)]">Your email is fixed and verified through the authentication workflow.</p></div>
            {profile.isLoading ? <Loading /> : profile.isError ? <ErrorState message={(profile.error as Error).message} /> : <>
              <Field label="Email"><input className="input" value={profile.data?.email ?? ""} disabled /></Field>
              <Field label="Name"><input className="input" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></Field>
              <Field label="Phone"><input className="input" type="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></Field>
              <Field label="Date of birth"><input className="input" type="date" value={form.dateOfBirth} onChange={(event) => setForm({ ...form, dateOfBirth: event.target.value })} /></Field>
              <Field label="Avatar URL"><input className="input" type="url" value={form.avatarUrl} onChange={(event) => setForm({ ...form, avatarUrl: event.target.value })} placeholder="https://…" /></Field>
              <Button disabled={save.isPending || form.name.trim().length < 2}>{save.isPending ? "Saving…" : "Save profile"}</Button>
            </>}
          </form>
          <form className="card grid content-start gap-4 p-6" onSubmit={(event) => { event.preventDefault(); changePassword.mutate(); }}>
            <div><h2 className="text-lg font-bold">Change password</h2><p className="mt-1 text-sm text-[var(--muted)]">This revokes every active refresh session, including this one.</p></div>
            <Field label="Current password"><input className="input" type="password" autoComplete="current-password" value={passwords.currentPassword} onChange={(event) => setPasswords({ ...passwords, currentPassword: event.target.value })} required /></Field>
            <Field label="New password"><input className="input" type="password" autoComplete="new-password" value={passwords.newPassword} onChange={(event) => setPasswords({ ...passwords, newPassword: event.target.value })} required /></Field>
            <p className="text-xs text-[var(--muted)]">Use at least 10 characters with upper- and lowercase letters and a number.</p>
            <Button variant="secondary" disabled={changePassword.isPending || passwords.newPassword.length < 10}>{changePassword.isPending ? "Updating…" : "Update password"}</Button>
          </form>
        </div>
        <section className="card mt-8 p-6">
          <h2 className="text-lg font-bold">Active sessions</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">Revoke devices you no longer recognize. This device may appear again after refresh-token rotation.</p>
          {sessions.isLoading ? <Loading /> : sessions.data?.length ? <div className="mt-5 divide-y divide-[var(--border)]">{sessions.data.map((session) => <div className="flex flex-wrap items-center justify-between gap-4 py-4" key={session.id}><div className="min-w-0"><p className="max-w-2xl truncate text-sm font-semibold">{session.userAgent ?? "Unknown device"}</p><p className="mt-1 text-xs text-[var(--muted)]">{session.ipAddress ?? "Unknown address"} · signed in {new Date(session.createdAt).toLocaleString()} · expires {new Date(session.expiresAt).toLocaleString()}</p></div><Button variant="secondary" disabled={revoke.isPending} onClick={() => revoke.mutate(session.id)}>Revoke</Button></div>)}</div> : <Empty title="No active sessions" />}
        </section>
      </div>
    </Protected>
  );
}

type PaymentOrder = { id: string; orderNumber: string; status: string; payments: Array<{ status: string; updatedAt: string }> };

export function PaymentStatus() {
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get("orderId") ?? "";
  const query = useQuery({
    queryKey: ["payment-status", orderId],
    queryFn: () => api<PaymentOrder>(`/orders/${orderId}`),
    enabled: Boolean(orderId),
    refetchInterval: (result) => ["REQUIRES_ACTION", "PROCESSING"].includes(result.state.data?.payments[0]?.status ?? "") ? 2500 : false,
  });

  if (!orderId) return <div className="container-shell py-20"><ErrorState message="The payment return URL is missing an order reference." /></div>;
  if (query.isLoading) return <Loading label="Verifying payment with the provider" />;
  if (query.isError || !query.data) return <div className="container-shell py-20"><ErrorState message={(query.error as Error)?.message} /></div>;

  const status = query.data.payments[0]?.status ?? "PROCESSING";
  const succeeded = ["SUCCEEDED", "PARTIALLY_REFUNDED", "REFUNDED"].includes(status);
  const failed = status === "FAILED";
  const Icon = succeeded ? CheckCircle2 : failed ? ShieldAlert : Clock3;
  return <Protected><div className="container-shell grid min-h-[65vh] place-items-center py-16"><section className="card max-w-xl p-8 text-center"><Icon className={`mx-auto ${succeeded ? "text-[var(--success)]" : failed ? "text-[var(--error)]" : "text-[var(--copper)]"}`} size={52} /><div className="mt-5"><Badge tone={succeeded ? "success" : failed ? "warning" : "neutral"}>{status.replaceAll("_", " ")}</Badge></div><h1 className="mt-5 font-editorial text-5xl">{succeeded ? "Payment confirmed" : failed ? "Payment was not completed" : "Payment is processing"}</h1><p className="mt-4 text-[var(--muted)]">{succeeded ? "The signed provider webhook confirmed your order." : failed ? "No order is marked paid without provider verification. You can return to your order for next steps." : "We are waiting for verified provider confirmation. This page updates automatically."}</p><p className="mt-5 text-sm font-semibold">Order {query.data.orderNumber}</p><div className="mt-7 flex flex-wrap justify-center gap-3"><Link className="btn btn-primary" to={`/orders/${query.data.id}`}>View order</Link><Link className="btn btn-secondary" to="/products">Continue shopping</Link></div></section></div></Protected>;
}
