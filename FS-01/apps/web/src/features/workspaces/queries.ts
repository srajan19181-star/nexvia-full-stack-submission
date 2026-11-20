import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CreatePageInput,
  CreateWorkspaceInput,
  InviteMemberInput,
  ReorderPagesInput,
  UpdateMemberInput,
  UpdatePageInput,
  UpdateWorkspaceInput,
} from "@nexvia/shared";
import { apiClient } from "@/lib/api-client";
import type {
  ActivityItem,
  DashboardData,
  PageItem,
  WorkspaceInvitationItem,
  WorkspaceMemberItem,
  WorkspaceSummary,
} from "./types";

export const workspaceKeys = {
  all: ["workspaces"] as const,
  detail: (workspaceId: string) => ["workspaces", workspaceId] as const,
  pages: (workspaceId: string, includeDeleted = false) => ["workspaces", workspaceId, "pages", includeDeleted] as const,
  members: (workspaceId: string) => ["workspaces", workspaceId, "members"] as const,
  invitations: (workspaceId: string) => ["workspaces", workspaceId, "invitations"] as const,
  activity: (workspaceId: string) => ["workspaces", workspaceId, "activity"] as const,
  dashboard: ["dashboard"] as const,
};

export function useWorkspaces() {
  return useQuery({
    queryKey: workspaceKeys.all,
    queryFn: async () => (await apiClient.get<{ data: { workspaces: WorkspaceSummary[] } }>("/workspaces")).data.workspaces,
  });
}

export function useWorkspace(workspaceId: string) {
  return useQuery({
    queryKey: workspaceKeys.detail(workspaceId),
    queryFn: async () =>
      (await apiClient.get<{ data: { workspace: WorkspaceSummary } }>(`/workspaces/${workspaceId}`)).data.workspace,
    enabled: Boolean(workspaceId),
  });
}

export function useDashboard() {
  return useQuery({
    queryKey: workspaceKeys.dashboard,
    queryFn: async () => (await apiClient.get<{ data: DashboardData }>("/dashboard")).data,
  });
}

export function usePages(workspaceId: string, includeDeleted = false) {
  return useQuery({
    queryKey: workspaceKeys.pages(workspaceId, includeDeleted),
    queryFn: async () =>
      (
        await apiClient.get<{ data: { pages: PageItem[] } }>(
          `/workspaces/${workspaceId}/pages${includeDeleted ? "?includeDeleted=true" : ""}`,
        )
      ).data.pages,
    enabled: Boolean(workspaceId),
  });
}

export function usePage(workspaceId: string, pageId: string) {
  return useQuery({
    queryKey: ["workspaces", workspaceId, "pages", pageId],
    queryFn: async () =>
      (await apiClient.get<{ data: { page: PageItem } }>(`/workspaces/${workspaceId}/pages/${pageId}`)).data.page,
    enabled: Boolean(workspaceId && pageId),
  });
}

export function useMembers(workspaceId: string) {
  return useQuery({
    queryKey: workspaceKeys.members(workspaceId),
    queryFn: async () =>
      (await apiClient.get<{ data: { members: WorkspaceMemberItem[] } }>(`/workspaces/${workspaceId}/members`)).data.members,
    enabled: Boolean(workspaceId),
  });
}

export function useInvitations(workspaceId: string, enabled: boolean) {
  return useQuery({
    queryKey: workspaceKeys.invitations(workspaceId),
    queryFn: async () =>
      (
        await apiClient.get<{ data: { invitations: WorkspaceInvitationItem[] } }>(
          `/workspaces/${workspaceId}/invitations`,
        )
      ).data.invitations,
    enabled: Boolean(workspaceId) && enabled,
  });
}

export function useActivity(workspaceId: string) {
  return useQuery({
    queryKey: workspaceKeys.activity(workspaceId),
    queryFn: async () =>
      (
        await apiClient.get<{ data: { items: ActivityItem[]; nextCursor: string | null } }>(
          `/workspaces/${workspaceId}/activity?limit=50`,
        )
      ).data,
    enabled: Boolean(workspaceId),
  });
}

export function useSearchPages(query: string) {
  return useQuery({
    queryKey: ["search", query],
    queryFn: async () =>
      (
        await apiClient.get<{
          data: {
            pages: Array<Pick<PageItem, "id" | "title" | "icon" | "workspaceId" | "updatedAt"> & { workspace: { name: string } }>;
            workspaces: Array<Pick<WorkspaceSummary, "id" | "name" | "slug" | "updatedAt">>;
          };
        }>(`/search?q=${encodeURIComponent(query)}`)
      ).data,
    enabled: query.trim().length > 0,
    staleTime: 30_000,
  });
}

export function useCreateWorkspace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateWorkspaceInput) =>
      apiClient.post<{ data: { workspace: WorkspaceSummary } }>("/workspaces", input),
    async onSuccess() {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: workspaceKeys.all }),
        queryClient.invalidateQueries({ queryKey: workspaceKeys.dashboard }),
      ]);
    },
  });
}

export function useUpdateWorkspace(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateWorkspaceInput) =>
      apiClient.patch<{ data: { workspace: WorkspaceSummary } }>(`/workspaces/${workspaceId}`, input),
    async onSuccess() {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: workspaceKeys.all }),
        queryClient.invalidateQueries({ queryKey: workspaceKeys.detail(workspaceId) }),
        queryClient.invalidateQueries({ queryKey: workspaceKeys.dashboard }),
      ]);
    },
  });
}

export function useDeleteWorkspace(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.delete<void>(`/workspaces/${workspaceId}`),
    async onSuccess() {
      queryClient.removeQueries({ queryKey: workspaceKeys.detail(workspaceId) });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: workspaceKeys.all }),
        queryClient.invalidateQueries({ queryKey: workspaceKeys.dashboard }),
      ]);
    },
  });
}

export function useCreatePage(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePageInput) =>
      apiClient.post<{ data: { page: PageItem } }>(`/workspaces/${workspaceId}/pages`, input),
    async onSuccess() {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["workspaces", workspaceId, "pages"] }),
        queryClient.invalidateQueries({ queryKey: workspaceKeys.detail(workspaceId) }),
        queryClient.invalidateQueries({ queryKey: workspaceKeys.dashboard }),
      ]);
    },
  });
}

export function useUpdatePage(workspaceId: string, pageId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdatePageInput) =>
      apiClient.patch<{ data: { page: PageItem } }>(`/workspaces/${workspaceId}/pages/${pageId}`, input),
    async onSuccess() {
      await queryClient.invalidateQueries({ queryKey: ["workspaces", workspaceId, "pages"] });
    },
  });
}

export function useDeletePage(workspaceId: string, pageId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.delete<void>(`/workspaces/${workspaceId}/pages/${pageId}`),
    async onSuccess() {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["workspaces", workspaceId, "pages"] }),
        queryClient.invalidateQueries({ queryKey: workspaceKeys.dashboard }),
      ]);
    },
  });
}

export function useRestorePage(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (pageId: string) =>
      apiClient.post<{ data: { page: PageItem } }>(`/workspaces/${workspaceId}/pages/${pageId}/restore`),
    async onSuccess() {
      await queryClient.invalidateQueries({ queryKey: ["workspaces", workspaceId, "pages"] });
    },
  });
}

export function useReorderPages(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ReorderPagesInput) =>
      apiClient.post<void>(`/workspaces/${workspaceId}/pages/reorder`, input),
    async onSuccess() {
      await queryClient.invalidateQueries({ queryKey: ["workspaces", workspaceId, "pages"] });
    },
  });
}

export function useSetFavorite(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ pageId, favorite }: { pageId: string; favorite: boolean }) =>
      favorite
        ? apiClient.post<void>(`/workspaces/${workspaceId}/pages/${pageId}/favorite`)
        : apiClient.delete<void>(`/workspaces/${workspaceId}/pages/${pageId}/favorite`),
    async onSuccess() {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["workspaces", workspaceId, "pages"] }),
        queryClient.invalidateQueries({ queryKey: workspaceKeys.dashboard }),
      ]);
    },
  });
}

export function useInviteMember(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: InviteMemberInput) => apiClient.post(`/workspaces/${workspaceId}/invitations`, input),
    async onSuccess() {
      await queryClient.invalidateQueries({ queryKey: workspaceKeys.invitations(workspaceId) });
    },
  });
}

export function useUpdateMember(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ memberId, input }: { memberId: string; input: UpdateMemberInput }) =>
      apiClient.patch(`/workspaces/${workspaceId}/members/${memberId}`, input),
    async onSuccess() {
      await queryClient.invalidateQueries({ queryKey: workspaceKeys.members(workspaceId) });
    },
  });
}

export function useRemoveMember(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (memberId: string) => apiClient.delete<void>(`/workspaces/${workspaceId}/members/${memberId}`),
    async onSuccess() {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: workspaceKeys.members(workspaceId) }),
        queryClient.invalidateQueries({ queryKey: workspaceKeys.detail(workspaceId) }),
      ]);
    },
  });
}

export function useRevokeInvitation(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (invitationId: string) =>
      apiClient.delete<void>(`/workspaces/${workspaceId}/invitations/${invitationId}`),
    async onSuccess() {
      await queryClient.invalidateQueries({ queryKey: workspaceKeys.invitations(workspaceId) });
    },
  });
}

export function useInvitationDecision() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ token, accept }: { token: string; accept: boolean }) =>
      apiClient.post<{ data: { accepted: boolean; workspace: { id: string; name: string } } }>(
        `/workspaces/invitations/${accept ? "accept" : "reject"}`,
        { token },
      ),
    async onSuccess() {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: workspaceKeys.all }),
        queryClient.invalidateQueries({ queryKey: workspaceKeys.dashboard }),
      ]);
    },
  });
}
