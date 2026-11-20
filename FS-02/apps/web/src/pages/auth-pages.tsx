import { useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, passwordSchema, registerSchema } from "@aureva/shared";
import type { z } from "zod";
import { post } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Button, Field, Loading } from "../components/ui";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function Login() { return <AuthForm mode="login"/>; }
export function Register() { return <AuthForm mode="register"/>; }

function AuthForm({ mode }: { mode: "login" | "register" }) {
  const navigate = useNavigate();
  const client = useQueryClient();
  const { user } = useAuth();
  const [serverError, setServerError] = useState("");
  const [verification, setVerification] = useState<{ email: string; developmentVerificationUrl?: string } | null>(null);
  const schema = mode === "login" ? loginSchema : registerSchema;
  type Values = z.infer<typeof schema>;
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: (mode === "login" ? { email: "", password: "" } : { name: "", email: "", password: "" }) as Values });
  if (user) return <Navigate to="/account" replace/>;
  const submit = form.handleSubmit(async (values) => {
    try {
      const result = await post<{ verificationRequired?: boolean; developmentVerificationUrl?: string }>(`/auth/${mode}`, values);
      if (mode === "register" && result.verificationRequired) { setVerification({ email: (values as { email: string }).email, ...(result.developmentVerificationUrl ? { developmentVerificationUrl: result.developmentVerificationUrl } : {}) }); return; }
      await client.invalidateQueries({ queryKey: ["me"] }); toast.success("Welcome back"); navigate("/account");
    } catch (error) { setServerError((error as Error).message); }
  });
  if (verification) return <SimpleAuth title="Check your inbox" copy={`We sent a verification link to ${verification.email}.`}><div className="grid gap-3">{verification.developmentVerificationUrl && <a className="btn btn-primary" href={verification.developmentVerificationUrl}>Open development verification link</a>}<Button variant="secondary" onClick={async () => { const result = await post<{ developmentVerificationUrl?: string }>("/auth/resend-verification", { email: verification.email }); setVerification({ email: verification.email, ...(result.developmentVerificationUrl ? { developmentVerificationUrl: result.developmentVerificationUrl } : {}) }); toast.success("Verification link sent"); }}>Resend link</Button></div></SimpleAuth>;
  return <div className="grid min-h-[calc(100vh-110px)] lg:grid-cols-2"><div className="hidden bg-[url('https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=1400&q=85')] bg-cover bg-center lg:block"/><div className="grid place-items-center p-6"><form onSubmit={submit} className="w-full max-w-md"><p className="eyebrow">{mode === "login" ? "Your account" : "Join our community"}</p><h1 className="mt-3 font-editorial text-5xl">{mode === "login" ? "Welcome back." : "Begin thoughtfully."}</h1><p className="mt-3 text-sm text-[var(--muted)]">{mode === "login" ? "Sign in to continue your considered collection." : "Create an account for wishlists, orders, and maker stories."}</p><div className="mt-8 grid gap-5">{mode === "register" && <Field label="Full name" error={(form.formState.errors as { name?: { message?: string } }).name?.message}><input className="input" autoComplete="name" {...form.register("name" as never)}/></Field>}<Field label="Email address" error={form.formState.errors.email?.message}><input className="input" type="email" autoComplete="email" {...form.register("email")}/></Field><Field label="Password" error={form.formState.errors.password?.message}><input className="input" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} {...form.register("password")}/></Field>{serverError && <p role="alert" className="text-sm text-[var(--error)]">{serverError}</p>}<Button disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}</Button></div><p className="mt-4 text-right text-sm"><Link className="underline" to="/forgot-password">Forgot password?</Link></p><p className="mt-6 text-center text-sm">{mode === "login" ? <>New to AUREVA? <Link className="font-bold underline" to="/register">Create account</Link></> : <>Already a member? <Link className="font-bold underline" to="/login">Sign in</Link></>}</p></form></div></div>;
}

export function VerifyEmail() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const query = useQuery({ queryKey: ["verify-email", token], queryFn: () => post<{ verified: boolean }>("/auth/verify-email", { token }), enabled: token.length >= 20, retry: false });
  if (query.isLoading) return <Loading label="Verifying your email"/>;
  return <SimpleAuth title={query.isSuccess ? "Email verified" : "Verification failed"} copy={query.isSuccess ? "Your account is active. You can now sign in." : token ? (query.error as Error)?.message ?? "This link is invalid or expired." : "The verification token is missing."}><Link className="btn btn-primary w-full" to={query.isSuccess ? "/login" : "/register"}>{query.isSuccess ? "Continue to sign in" : "Return to registration"}</Link></SimpleAuth>;
}

export function ForgotPassword() {
  const [sent, setSent] = useState(false);
  const [developmentResetUrl, setDevelopmentResetUrl] = useState<string>();
  const form = useForm<{ email: string }>();
  return <SimpleAuth title="Reset your password" copy="We’ll send reset instructions if the account exists."><form onSubmit={form.handleSubmit(async (values) => { const result = await post<{ developmentResetUrl?: string }>("/auth/forgot-password", values); setDevelopmentResetUrl(result.developmentResetUrl); setSent(true); })} className="grid gap-4"><input className="input" type="email" placeholder="Email address" {...form.register("email", { required: true })}/><Button>{sent ? "Instructions requested" : "Send reset instructions"}</Button>{developmentResetUrl && <a className="text-center text-sm font-bold underline" href={developmentResetUrl}>Open development reset link</a>}</form></SimpleAuth>;
}

export function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token") ?? "";
  const form = useForm<{ password: string; confirm: string }>();
  const [error, setError] = useState("");
  return <SimpleAuth title="Choose a new password" copy="Use at least 10 characters with upper-case, lower-case, and a number."><form className="grid gap-4" onSubmit={form.handleSubmit(async (values) => { const parsed = passwordSchema.safeParse(values.password); if (!parsed.success || values.password !== values.confirm) { setError(values.password !== values.confirm ? "Passwords do not match" : "Password does not meet the security requirements"); return; } try { await post("/auth/reset-password", { token, password: values.password }); toast.success("Password updated"); navigate("/login"); } catch (reason) { setError((reason as Error).message); } })}><input className="input" type="password" placeholder="New password" {...form.register("password", { required: true })}/><input className="input" type="password" placeholder="Confirm password" {...form.register("confirm", { required: true })}/>{error && <p role="alert" className="text-sm text-[var(--error)]">{error}</p>}<Button disabled={token.length < 20}>Update password</Button></form></SimpleAuth>;
}

function SimpleAuth({ title, copy, children }: { title: string; copy: string; children: React.ReactNode }) { return <div className="container-shell grid min-h-[65vh] place-items-center py-16"><div className="card w-full max-w-md p-8"><h1 className="font-editorial text-4xl">{title}</h1><p className="my-4 text-sm text-[var(--muted)]">{copy}</p>{children}</div></div>; }
