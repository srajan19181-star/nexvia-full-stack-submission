import { useState, type FormEvent } from "react";
import { ArrowLeft, CheckCircle2, LoaderCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { forgotPasswordInputSchema } from "@nexvia/shared";
import { AuthPageShell } from "@/components/layout/auth-page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/features/auth/auth-provider";
import { FormError } from "@/features/auth/form-error";
import { ApiError } from "@/lib/api-client";

export function ForgotPasswordPage() {
  const { forgotPassword } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);
    const parsed = forgotPasswordInputSchema.safeParse({ email: form.get("email") });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Enter a valid email address");
      return;
    }

    setSubmitting(true);
    try {
      await forgotPassword(parsed.data.email);
      setSent(true);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Could not request a reset link. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthPageShell eyebrow="Account recovery" title="Reset your password" description="Enter your email and we will send a time-limited reset link if it matches an account.">
      {sent ? (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 text-center shadow-sm">
          <CheckCircle2 className="mx-auto size-9 text-[var(--success)]" />
          <h3 className="mt-4 font-semibold">Check your inbox</h3>
          <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">If that email belongs to an account, a reset link is on its way.</p>
          <Button variant="secondary" className="mt-5" asChild><Link to="/login">Return to sign in</Link></Button>
        </div>
      ) : (
        <form className="space-y-5" onSubmit={(event) => void handleSubmit(event)} noValidate>
          <FormError message={error} />
          <div className="space-y-2">
            <Label htmlFor="email">Email address</Label>
            <Input id="email" name="email" type="email" autoComplete="email" placeholder="you@company.com" required />
          </div>
          <Button type="submit" size="lg" className="w-full" disabled={submitting}>
            {submitting && <LoaderCircle className="size-4 animate-spin" />} Send reset link
          </Button>
        </form>
      )}
      <Link to="/login" className="mt-7 flex items-center justify-center gap-2 text-sm font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)]"><ArrowLeft className="size-4" /> Back to sign in</Link>
    </AuthPageShell>
  );
}
