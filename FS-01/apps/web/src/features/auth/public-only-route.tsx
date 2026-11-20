import { Navigate, Outlet } from "react-router-dom";
import { LoadingSkeleton } from "@/components/ui/skeleton";
import { useAuth } from "./auth-provider";

export function PublicOnlyRoute() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div className="grid min-h-screen place-items-center"><LoadingSkeleton className="h-40 w-full max-w-sm rounded-2xl" /></div>;
  }

  return user ? <Navigate to="/dashboard" replace /> : <Outlet />;
}
