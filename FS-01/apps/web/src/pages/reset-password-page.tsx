import { useState, type FormEvent } from "react";
import { LoaderCircle } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { resetPasswordInputSchema } from "@nexvia/shared";
import { toast } from "sonner";
import { AuthPageShell } from "@/components/layout/auth-page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/features/auth/auth-provider";
import { FormError } from "@/features/auth/form-error";
import { ApiError } from "@/lib/api-client";

export function ResetPasswordPage() {
  const { resetPassword } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token") ?? "";
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(token ? null : "This reset link is missing its security token.");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirmation = String(form.get("confirmation") ?? "");
    if (password !== confirmation) {
      setError("The passwords do not match.");
      return;
    }

    const parsed = resetPasswordInputSchema.safeParse({ token, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Enter a valid new password.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await resetPassword(parsed.data);
      toast.success("Password updated. Sign in with your new password.");
      navigate("/login", { replace: true });
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Could not reset your password. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthPageShell eyebrow="Choose a new password" title="Secure your account" description="Your new password will sign out every existing session on this account.">
      <form className="space-y-5" onSubmit={(event) => void handleSubmit(event)} noValidate>
        <FormError message={error} />
        <div className="space-y-2">
          <Label htmlFor="password">New password</Label>
          <Input id="password" name="password" type="password" autoComplete="new-password" required disabled={!token} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirmation">Confirm new password</Label>
          <Input id="confirmation" name="confirmation" type="password" autoComplete="new-password" required disabled={!token} />
        </div>
        <Button type="submit" size="lg" className="w-full" disabled={submitting || !token}>
          {submitting && <LoaderCircle className="size-4 animate-spin" />} Update password
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-[var(--muted-foreground)]"><Link to="/forgot-password" className="font-medium text-[var(--brand)] hover:underline">Request another link</Link></p>
    </AuthPageShell>
  );
}
