import type { ContentRole, Page, Workspace, WorkspaceMember } from "@nexvia/database";
import type { EffectivePermissions, PublicUser } from "@nexvia/shared";

declare global {
  namespace Express {
    interface Request {
      auth?: {
        sessionId: string;
        user: PublicUser;
      };
      workspaceAccess?: {
        workspace: Workspace;
        membership: WorkspaceMember;
        permissions: EffectivePermissions;
      };
      pageAccess?: {
        page: Page;
        pageRole: ContentRole | null;
        permissions: EffectivePermissions;
      };
    }
  }
}

export {};
