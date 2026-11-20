import type { ContentRoleValue, WorkspaceRoleValue } from "@nexvia/shared";

export interface WorkspaceSummary {
  id: string;
  name: string;
  slug: string;
  workspaceRole: WorkspaceRoleValue;
  contentRole: ContentRoleValue;
  memberCount: number;
  pageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface PageItem {
  id: string;
  workspaceId: string;
  parentId: string | null;
  title: string;
  icon: string | null;
  coverUrl: string | null;
  sortOrder: number;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  isFavorite: boolean;
  permissions?: { view: boolean; comment: boolean; edit: boolean };
  documentGeneration?: number;
}

export interface WorkspaceMemberItem {
  id: string;
  user: { id: string; name: string; email: string; avatarUrl: string | null };
  workspaceRole: WorkspaceRoleValue;
  contentRole: ContentRoleValue;
  joinedAt: string;
}

export interface WorkspaceInvitationItem {
  id: string;
  email: string;
  workspaceRole: WorkspaceRoleValue;
  contentRole: ContentRoleValue;
  status: "PENDING" | "ACCEPTED" | "REJECTED" | "REVOKED" | "EXPIRED";
  expiresAt: string;
  createdAt: string;
  invitedBy: { id: string; name: string };
}

export interface ActivityItem {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  actor: { id: string; name: string; avatarUrl: string | null } | null;
  page: { id: string; title: string; icon: string | null } | null;
  workspace?: { id: string; name: string };
}

export interface DashboardData {
  workspaces: WorkspaceSummary[];
  recentPages: Array<PageItem & { workspace: { id: string; name: string } }>;
  activity: ActivityItem[];
}
