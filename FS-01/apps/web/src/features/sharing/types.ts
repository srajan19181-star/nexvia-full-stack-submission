import type { ContentRoleValue, EffectivePermissions, WorkspaceRoleValue } from "@nexvia/shared";

export interface PagePermissionItem {
  id: string;
  workspaceId: string;
  userId: string;
  workspaceRole: WorkspaceRoleValue;
  contentRole: ContentRoleValue;
  joinedAt: string;
  user: { id: string; name: string; email: string; avatarUrl: string | null };
  pageRole: ContentRoleValue | null;
  permissionUpdatedAt: string | null;
  effectivePermissions: EffectivePermissions;
}
