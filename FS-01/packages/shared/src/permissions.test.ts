import { describe, expect, it } from "vitest";
import { calculateEffectivePermissions } from "./permissions.js";

describe("calculateEffectivePermissions", () => {
  it("grants owners full workspace permissions", () => {
    expect(
      calculateEffectivePermissions({
        workspaceRole: "OWNER",
        contentRole: "VIEWER",
      }),
    ).toEqual({
      view: true,
      comment: true,
      edit: true,
      inviteMembers: true,
      manageMembers: true,
      manageWorkspace: true,
      deleteWorkspace: true,
    });
  });

  it("allows commenters to comment without editing", () => {
    const permissions = calculateEffectivePermissions({
      workspaceRole: "MEMBER",
      contentRole: "COMMENTER",
    });

    expect(permissions.view).toBe(true);
    expect(permissions.comment).toBe(true);
    expect(permissions.edit).toBe(false);
  });

  it("applies a page override to a member", () => {
    const permissions = calculateEffectivePermissions({
      workspaceRole: "MEMBER",
      contentRole: "EDITOR",
      pageRole: "VIEWER",
    });

    expect(permissions.view).toBe(true);
    expect(permissions.comment).toBe(false);
    expect(permissions.edit).toBe(false);
  });
});
