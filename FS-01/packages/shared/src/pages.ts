import { z } from "zod";

const nullablePageIdSchema = z.string().cuid().nullable();

export const createPageInputSchema = z.object({
  title: z.string().trim().min(1).max(200).default("Untitled"),
  parentId: nullablePageIdSchema.optional(),
  icon: z.string().trim().max(16).nullable().optional(),
});

export const updatePageInputSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    parentId: nullablePageIdSchema.optional(),
    icon: z.string().trim().max(16).nullable().optional(),
    coverUrl: z.string().url().max(2_048).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "At least one page field is required" });

export const reorderPagesInputSchema = z.object({
  parentId: nullablePageIdSchema,
  orderedPageIds: z.array(z.string().cuid()).min(1).max(500),
});

export const pageListQuerySchema = z.object({
  includeDeleted: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
});

export const workspaceSearchQuerySchema = z.object({
  q: z.string().trim().min(1).max(120),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const setPagePermissionInputSchema = z.object({
  role: z.enum(["EDITOR", "COMMENTER", "VIEWER"]),
});

export type CreatePageInput = z.infer<typeof createPageInputSchema>;
export type UpdatePageInput = z.infer<typeof updatePageInputSchema>;
export type ReorderPagesInput = z.infer<typeof reorderPagesInputSchema>;
export type PageListQuery = z.infer<typeof pageListQuerySchema>;
export type SetPagePermissionInput = z.infer<typeof setPagePermissionInputSchema>;
