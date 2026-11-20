import {
  createContext,
  useContext,
  type ReactNode,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { LoginInput, PublicUser, RegisterInput, ResetPasswordInput, UpdateProfileInput } from "@nexvia/shared";
import { ApiError, apiClient } from "@/lib/api-client";

interface AuthContextValue {
  user: PublicUser | null;
  isLoading: boolean;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  resetPassword: (input: ResetPasswordInput) => Promise<void>;
  updateProfile: (input: UpdateProfileInput) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const authQueryKey = ["auth", "current-user"] as const;

interface AuthResponse {
  data: { user: PublicUser };
  csrfToken?: string;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const currentUser = useQuery({
    queryKey: authQueryKey,
    queryFn: async () => {
      try {
        const response = await apiClient.get<AuthResponse>("/auth/me");
        return response.data.user;
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          return null;
        }
        throw error;
      }
    },
    retry: false,
    staleTime: 60_000,
  });

  const loginMutation = useMutation({
    mutationFn: (input: LoginInput) => apiClient.post<AuthResponse>("/auth/login", input),
    onSuccess(response) {
      queryClient.setQueryData(authQueryKey, response.data.user);
    },
  });

  const registerMutation = useMutation({
    mutationFn: (input: RegisterInput) => apiClient.post<AuthResponse>("/auth/register", input),
    onSuccess(response) {
      queryClient.setQueryData(authQueryKey, response.data.user);
    },
  });

  const logoutMutation = useMutation({
    mutationFn: () => apiClient.post<void>("/auth/logout"),
    onSuccess() {
      queryClient.setQueryData(authQueryKey, null);
      queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== "auth" });
    },
  });

  const forgotMutation = useMutation({
    mutationFn: (email: string) => apiClient.post("/auth/forgot-password", { email }),
  });

  const resetMutation = useMutation({
    mutationFn: (input: ResetPasswordInput) => apiClient.post<void>("/auth/reset-password", input),
    onSuccess() {
      queryClient.setQueryData(authQueryKey, null);
    },
  });

  const profileMutation = useMutation({
    mutationFn: (input: UpdateProfileInput) => apiClient.patch<AuthResponse>("/auth/me", input),
    onSuccess(response) {
      queryClient.setQueryData(authQueryKey, response.data.user);
    },
  });

  return (
    <AuthContext.Provider
      value={{
        user: currentUser.data ?? null,
        isLoading: currentUser.isPending,
        async login(input) {
          await loginMutation.mutateAsync(input);
        },
        async register(input) {
          await registerMutation.mutateAsync(input);
        },
        async logout() {
          await logoutMutation.mutateAsync();
        },
        async forgotPassword(email) {
          await forgotMutation.mutateAsync(email);
        },
        async resetPassword(input) {
          await resetMutation.mutateAsync(input);
        },
        async updateProfile(input) {
          await profileMutation.mutateAsync(input);
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
