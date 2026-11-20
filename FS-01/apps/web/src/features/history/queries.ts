import type { CreateSnapshotInput, RestoreSnapshotInput } from "@nexvia/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { SnapshotItem, SnapshotPreview } from "./types";

const key = (workspaceId: string, pageId: string) => ["workspaces", workspaceId, "pages", pageId, "history"] as const;
const path = (workspaceId: string, pageId: string) => `/workspaces/${workspaceId}/pages/${pageId}/history`;

export function useVersionHistory(workspaceId: string, pageId: string) {
  return useQuery({
    queryKey: key(workspaceId, pageId),
    queryFn: async () =>
      (await apiClient.get<{ data: { items: SnapshotItem[]; nextCursor: string | null } }>(`${path(workspaceId, pageId)}?limit=50`)).data,
    enabled: Boolean(workspaceId && pageId),
  });
}

export function useSnapshotPreview(workspaceId: string, pageId: string, snapshotId: string | null) {
  return useQuery({
    queryKey: [...key(workspaceId, pageId), "preview", snapshotId],
    queryFn: async () =>
      (await apiClient.get<{ data: { snapshot: SnapshotPreview } }>(`${path(workspaceId, pageId)}/${snapshotId}`)).data.snapshot,
    enabled: Boolean(snapshotId),
  });
}

export function useCreateSnapshot(workspaceId: string, pageId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateSnapshotInput) => apiClient.post(`${path(workspaceId, pageId)}`, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key(workspaceId, pageId) }),
  });
}

export function useRestoreSnapshot(workspaceId: string, pageId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ snapshotId, input }: { snapshotId: string; input: RestoreSnapshotInput }) =>
      apiClient.post<{ data: { snapshotId: string; preRestoreSnapshotId: string; generation: number } }>(
        `${path(workspaceId, pageId)}/${snapshotId}/restore`,
        input,
      ),
    async onSuccess() {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: key(workspaceId, pageId) }),
        queryClient.invalidateQueries({ queryKey: ["workspaces", workspaceId, "pages", pageId] }),
      ]);
    },
  });
}
