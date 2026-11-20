import type { CreateCommentInput, CreateCommentReplyInput } from "@nexvia/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { CommentItem, CommentReplyItem } from "./types";

function commentKey(workspaceId: string, pageId: string) {
  return ["workspaces", workspaceId, "pages", pageId, "comments"] as const;
}

function commentPath(workspaceId: string, pageId: string) {
  return `/workspaces/${workspaceId}/pages/${pageId}/comments`;
}

export function useComments(workspaceId: string, pageId: string, includeResolved: boolean) {
  return useQuery({
    queryKey: [...commentKey(workspaceId, pageId), { includeResolved }],
    queryFn: async () =>
      (
        await apiClient.get<{ data: { comments: CommentItem[] } }>(
          `${commentPath(workspaceId, pageId)}?includeResolved=${includeResolved}`,
        )
      ).data.comments,
    enabled: Boolean(workspaceId && pageId),
  });
}

function useRefreshComments(workspaceId: string, pageId: string) {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: commentKey(workspaceId, pageId) });
}

export function useCreateComment(workspaceId: string, pageId: string) {
  const refresh = useRefreshComments(workspaceId, pageId);
  return useMutation({
    mutationFn: (input: CreateCommentInput) =>
      apiClient.post<{ data: { comment: CommentItem } }>(commentPath(workspaceId, pageId), input),
    onSuccess: refresh,
  });
}

export function useReplyToComment(workspaceId: string, pageId: string) {
  const refresh = useRefreshComments(workspaceId, pageId);
  return useMutation({
    mutationFn: ({ commentId, input }: { commentId: string; input: CreateCommentReplyInput }) =>
      apiClient.post<{ data: { reply: CommentReplyItem } }>(
        `${commentPath(workspaceId, pageId)}/${commentId}/replies`,
        input,
      ),
    onSuccess: refresh,
  });
}

export function useSetCommentResolved(workspaceId: string, pageId: string) {
  const refresh = useRefreshComments(workspaceId, pageId);
  return useMutation({
    mutationFn: ({ commentId, resolved }: { commentId: string; resolved: boolean }) =>
      apiClient.patch(`${commentPath(workspaceId, pageId)}/${commentId}/status`, { resolved }),
    onSuccess: refresh,
  });
}

export function useDeleteComment(workspaceId: string, pageId: string) {
  const refresh = useRefreshComments(workspaceId, pageId);
  return useMutation({
    mutationFn: (commentId: string) => apiClient.delete(`${commentPath(workspaceId, pageId)}/${commentId}`),
    onSuccess: refresh,
  });
}

export function useDeleteCommentReply(workspaceId: string, pageId: string) {
  const refresh = useRefreshComments(workspaceId, pageId);
  return useMutation({
    mutationFn: ({ commentId, replyId }: { commentId: string; replyId: string }) =>
      apiClient.delete(`${commentPath(workspaceId, pageId)}/${commentId}/replies/${replyId}`),
    onSuccess: refresh,
  });
}
