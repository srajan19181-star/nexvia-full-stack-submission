import { z } from "zod";
import { emailSchema } from "./auth.js";
import { contentRoles, workspaceRoles } from "./permissions.js";

export const workspaceIdSchema = z.string().cuid();
export const workspaceRoleSchema = z.enum(workspaceRoles);
export const contentRoleSchema = z.enum(contentRoles);

export const createWorkspaceInputSchema = z.object({
  name: z.string().trim().min(2, "Workspace name must be at least 2 characters").max(80),
});

export const updateWorkspaceInputSchema = z.object({
  name: z.string().trim().min(2).max(80),
});

export const inviteMemberInputSchema = z.object({
  email: emailSchema,
  workspaceRole: z.enum(["ADMIN", "MEMBER"]).default("MEMBER"),
  contentRole: contentRoleSchema.default("EDITOR"),
});

export const updateMemberInputSchema = z
  .object({
    workspaceRole: z.enum(["ADMIN", "MEMBER"]).optional(),
    contentRole: contentRoleSchema.optional(),
  })
  .refine((value) => value.workspaceRole !== undefined || value.contentRole !== undefined, {
    message: "At least one membership field is required",
  });

export const invitationDecisionInputSchema = z.object({
  token: z.string().min(32).max(512),
});

export type CreateWorkspaceInput = z.infer<typeof createWorkspaceInputSchema>;
export type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceInputSchema>;
export type InviteMemberInput = z.infer<typeof inviteMemberInputSchema>;
export type UpdateMemberInput = z.infer<typeof updateMemberInputSchema>;
export type InvitationDecisionInput = z.infer<typeof invitationDecisionInputSchema>;
