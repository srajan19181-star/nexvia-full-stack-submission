import { z } from "zod";

const encodedYjsValueSchema = z.string().min(1).max(131_072).regex(/^[A-Za-z0-9_-]+$/);

export const commentAnchorInputSchema = z.object({
  start: encodedYjsValueSchema,
  end: encodedYjsValueSchema,
  stateVector: encodedYjsValueSchema,
  quote: z.string().trim().min(1).max(2_000),
});

export const createCommentInputSchema = z.object({
  body: z.string().trim().min(1).max(5_000),
  anchor: commentAnchorInputSchema.optional(),
});

export const createCommentReplyInputSchema = z.object({
  body: z.string().trim().min(1).max(5_000),
});

export const updateCommentStatusInputSchema = z.object({
  resolved: z.boolean(),
});

export const commentListQuerySchema = z.object({
  includeResolved: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true"),
});

export type CreateCommentInput = z.infer<typeof createCommentInputSchema>;
export type CreateCommentReplyInput = z.infer<typeof createCommentReplyInputSchema>;
export type UpdateCommentStatusInput = z.infer<typeof updateCommentStatusInputSchema>;
