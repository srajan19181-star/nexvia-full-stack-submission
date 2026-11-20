import type { SetPagePermissionInput } from "@nexvia/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { PagePermissionItem } from "./types";

const key = (workspaceId: string, pageId: string) => ["workspaces", workspaceId, "pages", pageId, "permissions"] as const;
const path = (workspaceId: string, pageId: string) => `/workspaces/${workspaceId}/pages/${pageId}/permissions`;

export function usePagePermissions(workspaceId: string, pageId: string, enabled: boolean) {
  return useQuery({
    queryKey: key(workspaceId, pageId),
    queryFn: async () =>
      (await apiClient.get<{ data: { permissions: PagePermissionItem[] } }>(path(workspaceId, pageId))).data.permissions,
    enabled: Boolean(workspaceId && pageId && enabled),
  });
}

export function useSetPagePermission(workspaceId: string, pageId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ memberId, input }: { memberId: string; input: SetPagePermissionInput }) =>
      apiClient.patch(`${path(workspaceId, pageId)}/${memberId}`, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key(workspaceId, pageId) }),
  });
}

export function useRemovePagePermission(workspaceId: string, pageId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (memberId: string) => apiClient.delete(`${path(workspaceId, pageId)}/${memberId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key(workspaceId, pageId) }),
  });
}
