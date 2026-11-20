export const workspaceRoles = ["OWNER", "ADMIN", "MEMBER"] as const;
export const contentRoles = ["EDITOR", "COMMENTER", "VIEWER"] as const;

export type WorkspaceRoleValue = (typeof workspaceRoles)[number];
export type ContentRoleValue = (typeof contentRoles)[number];

export interface PermissionContext {
  workspaceRole: WorkspaceRoleValue;
  contentRole: ContentRoleValue;
  pageRole?: ContentRoleValue | null;
}

export interface EffectivePermissions {
  view: boolean;
  comment: boolean;
  edit: boolean;
  inviteMembers: boolean;
  manageMembers: boolean;
  manageWorkspace: boolean;
  deleteWorkspace: boolean;
}

export function calculateEffectivePermissions(context: PermissionContext): EffectivePermissions {
  if (context.workspaceRole === "OWNER") {
    return {
      view: true,
      comment: true,
      edit: true,
      inviteMembers: true,
      manageMembers: true,
      manageWorkspace: true,
      deleteWorkspace: true,
    };
  }

  if (context.workspaceRole === "ADMIN") {
    return {
      view: true,
      comment: true,
      edit: true,
      inviteMembers: true,
      manageMembers: true,
      manageWorkspace: true,
      deleteWorkspace: false,
    };
  }

  const role = context.pageRole ?? context.contentRole;

  return {
    view: true,
    comment: role === "EDITOR" || role === "COMMENTER",
    edit: role === "EDITOR",
    inviteMembers: false,
    manageMembers: false,
    manageWorkspace: false,
    deleteWorkspace: false,
  };
}

export function canRoleMutateDocument(context: PermissionContext): boolean {
  return calculateEffectivePermissions(context).edit;
}
