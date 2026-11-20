import { Navigate, Outlet, useLocation } from "react-router-dom";
import { LoadingSkeleton } from "@/components/ui/skeleton";
import { useAuth } from "./auth-provider";

export function ProtectedRoute() {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--background)] p-6" aria-label="Loading session">
        <div className="w-full max-w-sm space-y-4">
          <LoadingSkeleton className="mx-auto size-12 rounded-2xl" />
          <LoadingSkeleton className="mx-auto h-5 w-44" />
          <LoadingSkeleton className="h-28 w-full rounded-2xl" />
        </div>
      </main>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
  }

  return <Outlet />;
}
