import { z } from "zod";

export const createSnapshotInputSchema = z.object({
  label: z.string().trim().min(1).max(120).optional(),
});

export const restoreSnapshotInputSchema = z.object({
  label: z.string().trim().min(1).max(120).optional(),
});

export const historyListQuerySchema = z.object({
  cursor: z.string().cuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

const activityMetadataSchema = z.object({
  ipAddress: z.string().max(128).optional(),
  userAgent: z.string().max(1_024).optional(),
});

export const internalCreateSnapshotSchema = z.object({
  actorId: z.string().cuid(),
  label: z.string().trim().min(1).max(120).optional(),
  activity: activityMetadataSchema.optional(),
});

export const internalRestoreSnapshotSchema = internalCreateSnapshotSchema;

export type CreateSnapshotInput = z.infer<typeof createSnapshotInputSchema>;
export type RestoreSnapshotInput = z.infer<typeof restoreSnapshotInputSchema>;
export type HistoryListQuery = z.infer<typeof historyListQuerySchema>;
export type InternalCreateSnapshotInput = z.infer<typeof internalCreateSnapshotSchema>;
export type InternalRestoreSnapshotInput = z.infer<typeof internalRestoreSnapshotSchema>;
