import { createBrowserRouter } from "react-router-dom";
import { ProtectedRoute } from "@/features/auth/protected-route";
import { PublicOnlyRoute } from "@/features/auth/public-only-route";

function RouteFallback() {
  return (
    <div className="grid min-h-screen place-items-center bg-[var(--background)] text-sm text-[var(--muted-foreground)]">
      Loading Orvyn…
    </div>
  );
}

const hydrateFallbackElement = <RouteFallback />;

export const router = createBrowserRouter([
  {
    path: "/",
    hydrateFallbackElement,
    lazy: async () => ({ Component: (await import("@/pages/landing-page")).LandingPage }),
  },
  {
    element: <PublicOnlyRoute />,
    hydrateFallbackElement,
    children: [
      {
        path: "/login",
        lazy: async () => ({ Component: (await import("@/pages/login-page")).LoginPage }),
      },
      {
        path: "/register",
        lazy: async () => ({ Component: (await import("@/pages/register-page")).RegisterPage }),
      },
      {
        path: "/forgot-password",
        lazy: async () => ({ Component: (await import("@/pages/forgot-password-page")).ForgotPasswordPage }),
      },
      {
        path: "/reset-password",
        lazy: async () => ({ Component: (await import("@/pages/reset-password-page")).ResetPasswordPage }),
      },
    ],
  },
  {
    element: <ProtectedRoute />,
    hydrateFallbackElement,
    children: [
      {
        path: "/invite",
        lazy: async () => ({ Component: (await import("@/pages/invitation-page")).InvitationPage }),
      },
      {
        lazy: async () => ({ Component: (await import("@/components/layout/app-shell")).AppShell }),
        children: [
          {
            path: "/dashboard",
            lazy: async () => ({ Component: (await import("@/pages/dashboard-page")).DashboardPage }),
          },
          {
            path: "/settings",
            lazy: async () => ({ Component: (await import("@/pages/settings-page")).SettingsPage }),
          },
          {
            path: "/workspace/:workspaceId",
            lazy: async () => ({ Component: (await import("@/pages/workspace-home-page")).WorkspaceHomePage }),
          },
          {
            path: "/workspace/:workspaceId/page/:pageId",
            lazy: async () => ({ Component: (await import("@/pages/editor-page")).EditorPage }),
          },
          {
            path: "/workspace/:workspaceId/members",
            lazy: async () => ({ Component: (await import("@/pages/workspace-members-page")).WorkspaceMembersPage }),
          },
          {
            path: "/workspace/:workspaceId/settings",
            lazy: async () => ({ Component: (await import("@/pages/workspace-settings-page")).WorkspaceSettingsPage }),
          },
          {
            path: "/workspace/:workspaceId/activity",
            lazy: async () => ({ Component: (await import("@/pages/workspace-activity-page")).WorkspaceActivityPage }),
          },
        ],
      },
    ],
  },
  {
    path: "/404",
    hydrateFallbackElement,
    lazy: async () => ({ Component: (await import("@/pages/not-found-page")).NotFoundPage }),
  },
  {
    path: "*",
    hydrateFallbackElement,
    lazy: async () => ({ Component: (await import("@/pages/not-found-page")).NotFoundPage }),
  },
]);
