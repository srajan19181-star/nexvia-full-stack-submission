import { Check, Monitor, Moon, Save, Sun, UserRound } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { useTheme, type ThemeMode } from "@/app/theme-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/features/auth/auth-provider";
import { ApiError } from "@/lib/api-client";
import { cn, initials } from "@/lib/utils";

const themes: Array<{ value: ThemeMode; label: string; icon: typeof Sun }> = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

function persistedTheme(theme: ThemeMode): "LIGHT" | "DARK" | "SYSTEM" {
  return theme.toUpperCase() as "LIGHT" | "DARK" | "SYSTEM";
}

export function SettingsPage() {
  const { user, updateProfile } = useAuth();
  const { theme, setTheme } = useTheme();
  const [name, setName] = useState(user?.name ?? "");
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(user?.name ?? "");
    setAvatarUrl(user?.avatarUrl ?? "");
  }, [user]);

  if (!user) return null;

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    try {
      await updateProfile({ name, avatarUrl: avatarUrl.trim() || null });
      toast.success("Profile updated");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not update your profile");
    } finally {
      setSaving(false);
    }
  };

  const selectTheme = async (nextTheme: ThemeMode) => {
    const previousTheme = theme;
    setTheme(nextTheme);
    try {
      await updateProfile({ theme: persistedTheme(nextTheme) });
    } catch {
      setTheme(previousTheme);
      toast.error("Could not save your theme preference");
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="relative overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-panel)] sm:p-8">
        <div className="relative flex items-center gap-4">
          <span className="grid size-12 place-items-center rounded-xl border border-[var(--glass-border)] bg-[var(--brand-soft)] text-[var(--brand)]"><UserRound className="size-5" /></span>
          <div><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--brand)]">Your account</p><h1 className="mt-1 text-3xl font-semibold tracking-[-0.04em]">Personal settings</h1><p className="mt-1 text-sm text-[var(--muted-foreground)]">Manage your profile and interface preferences.</p></div>
        </div>
      </div>

      <div className="mt-8 space-y-6">
        <Card className="p-6 sm:p-7">
          <h2 className="font-semibold">Profile</h2>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">Your identity across every workspace.</p>
          <form onSubmit={(event) => void saveProfile(event)} className="mt-6 grid gap-6 sm:grid-cols-[auto_minmax(0,1fr)]">
            {avatarUrl.trim() ? (
              <img src={avatarUrl} alt="Profile preview" className="size-20 rounded-xl border border-[var(--border)] object-cover" />
            ) : (
              <span className="grid size-20 place-items-center rounded-xl border border-[var(--glass-border-strong)] bg-[var(--brand-soft)] text-lg font-semibold text-[var(--brand)]">{initials(name || user.name)}</span>
            )}
            <div className="space-y-4">
              <div className="space-y-2"><Label htmlFor="profile-name">Display name</Label><Input id="profile-name" value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={80} required /></div>
              <div className="space-y-2"><Label htmlFor="profile-avatar">Avatar URL</Label><Input id="profile-avatar" type="url" value={avatarUrl} onChange={(event) => setAvatarUrl(event.target.value)} maxLength={2048} placeholder="https://example.com/avatar.jpg" /></div>
              <div><p className="text-xs text-[var(--muted-foreground)]">Signed in as {user.email}</p><Button type="submit" className="mt-4" disabled={saving}><Save className="size-4" /> {saving ? "Saving…" : "Save profile"}</Button></div>
            </div>
          </form>
        </Card>

        <Card className="p-6 sm:p-7">
          <h2 className="font-semibold">Appearance</h2>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">Your theme preference is saved to your account and this browser.</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {themes.map((option) => (
              <button
                type="button"
                key={option.value}
                onClick={() => void selectTheme(option.value)}
                className={cn(
                  "relative flex min-h-24 flex-col items-start justify-between rounded-xl border p-4 text-left transition",
                  theme === option.value ? "border-[var(--glass-border-strong)] bg-[var(--brand-soft)] shadow-[0_14px_35px_-24px_var(--glow-cyan)]" : "border-[var(--glass-border)] bg-[var(--glass)] hover:border-[var(--glass-border-strong)] hover:bg-[var(--glass-hover)]",
                )}
              >
                <option.icon className="size-5 text-[var(--muted-foreground)]" />
                <span className="text-sm font-medium">{option.label}</span>
                {theme === option.value && <span className="absolute right-3 top-3 grid size-5 place-items-center rounded-full bg-[var(--brand)] text-[var(--background)]"><Check className="size-3" /></span>}
              </button>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
