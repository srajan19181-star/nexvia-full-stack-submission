import { z } from "zod";

export const requestIdSchema = z.string().min(8);

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
    requestId: z.string().optional(),
  }),
});

export const paginationInputSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export type ApiErrorBody = z.infer<typeof apiErrorSchema>;
export type PaginationInput = z.infer<typeof paginationInputSchema>;
