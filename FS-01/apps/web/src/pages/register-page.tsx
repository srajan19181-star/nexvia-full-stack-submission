import { useState, type FormEvent } from "react";
import { Check, Eye, EyeOff, LoaderCircle } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { registerInputSchema } from "@nexvia/shared";
import { AuthPageShell } from "@/components/layout/auth-page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/features/auth/auth-provider";
import { FormError } from "@/features/auth/form-error";
import { ApiError } from "@/lib/api-client";

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | undefined>>({});

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setFieldErrors({});
    const form = new FormData(event.currentTarget);
    const parsed = registerInputSchema.safeParse({
      name: form.get("name"),
      email: form.get("email"),
      password: form.get("password"),
    });

    if (!parsed.success) {
      const errors = parsed.error.flatten().fieldErrors;
      setFieldErrors({ name: errors.name?.[0], email: errors.email?.[0], password: errors.password?.[0] });
      return;
    }

    setSubmitting(true);
    try {
      await register(parsed.data);
      const destination = (location.state as { from?: string } | null)?.from ?? "/dashboard";
      navigate(destination, { replace: true });
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Unable to create your account. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthPageShell eyebrow="Start fresh" title="Create your Orvyn account" description="Set up your private space now. You can create a workspace and invite collaborators next.">
      <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)} noValidate>
        <FormError message={error} />
        <div className="space-y-2">
          <Label htmlFor="name">Full name</Label>
          <Input id="name" name="name" autoComplete="name" placeholder="Ada Lovelace" required aria-invalid={Boolean(fieldErrors.name)} />
          {fieldErrors.name && <p className="text-xs text-[var(--danger)]">{fieldErrors.name}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Work email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" placeholder="ada@company.com" required aria-invalid={Boolean(fieldErrors.email)} />
          {fieldErrors.email && <p className="text-xs text-[var(--danger)]">{fieldErrors.email}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Input id="password" name="password" type={showPassword ? "text" : "password"} autoComplete="new-password" placeholder="At least 12 characters" required className="pr-11" aria-invalid={Boolean(fieldErrors.password)} />
            <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute inset-y-0 right-0 grid w-11 place-items-center text-[var(--muted-foreground)] hover:text-[var(--foreground)]" aria-label={showPassword ? "Hide password" : "Show password"}>
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          {fieldErrors.password ? <p className="text-xs text-[var(--danger)]">{fieldErrors.password}</p> : (
            <p className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)]"><Check className="size-3.5 text-[var(--success)]" /> Use upper and lowercase letters, a number, and a symbol.</p>
          )}
        </div>
        <Button type="submit" size="lg" className="mt-2 w-full" disabled={submitting}>
          {submitting && <LoaderCircle className="size-4 animate-spin" />} Create account
        </Button>
      </form>
      <p className="mt-5 text-center text-xs leading-5 text-[var(--muted-foreground)]">By continuing, you agree to use Orvyn responsibly and protect access to your account.</p>
      <p className="mt-5 text-center text-sm text-[var(--muted-foreground)]">Already have an account? <Link to="/login" className="font-semibold text-[var(--brand)] hover:underline">Sign in</Link></p>
    </AuthPageShell>
  );
}
