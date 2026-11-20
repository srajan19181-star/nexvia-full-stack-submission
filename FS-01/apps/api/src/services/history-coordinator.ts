import { createInternalRequestSignature } from "@nexvia/shared/server-crypto";
import type { ApiEnv } from "../config/env.js";
import { AppError } from "../lib/errors.js";
import type { RequestMetadata } from "./auth.service.js";

export interface SnapshotCommand {
  pageId: string;
  actorId: string;
  label?: string;
  activity: RequestMetadata;
}

export interface RestoreCommand extends SnapshotCommand {
  snapshotId: string;
}

export interface HistoryCoordinator {
  createSnapshot(command: SnapshotCommand): Promise<{ snapshot: { id: string; generation: number; kind: string; label: string | null; createdAt: string } }>;
  restoreSnapshot(command: RestoreCommand): Promise<{ snapshotId: string; preRestoreSnapshotId: string; generation: number }>;
}

export class HttpHistoryCoordinator implements HistoryCoordinator {
  constructor(private readonly env: ApiEnv) {}

  async createSnapshot(command: SnapshotCommand) {
    return this.request<{ data: { snapshot: { id: string; generation: number; kind: string; label: string | null; createdAt: string } } }>(
      `/internal/pages/${command.pageId}/snapshots`,
      { actorId: command.actorId, ...(command.label === undefined ? {} : { label: command.label }), activity: command.activity },
    ).then((response) => response.data);
  }

  async restoreSnapshot(command: RestoreCommand) {
    return this.request<{ data: { snapshotId: string; preRestoreSnapshotId: string; generation: number } }>(
      `/internal/pages/${command.pageId}/snapshots/${command.snapshotId}/restore`,
      { actorId: command.actorId, ...(command.label === undefined ? {} : { label: command.label }), activity: command.activity },
    ).then((response) => response.data);
  }

  private async request<T>(path: string, payload: unknown): Promise<T> {
    const body = JSON.stringify(payload);
    const timestamp = Date.now().toString();
    const signature = createInternalRequestSignature(
      this.env.COLLABORATION_INTERNAL_SECRET,
      "POST",
      path,
      timestamp,
      body,
    );
    let response: Response;
    try {
      response = await fetch(`${this.env.COLLABORATION_INTERNAL_URL.replace(/\/$/, "")}${path}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-nexvia-timestamp": timestamp,
          "x-nexvia-signature": signature,
        },
        body,
        signal: AbortSignal.timeout(10_000),
      });
    } catch (error) {
      throw new AppError({
        statusCode: 503,
        code: "COLLABORATION_UNAVAILABLE",
        message: "Version history is temporarily unavailable",
        details: error instanceof Error ? error.message : undefined,
      });
    }

    const result = await response.json().catch(() => undefined) as
      | T
      | { error?: { code?: string; message?: string } }
      | undefined;
    if (!response.ok) {
      const internalError = typeof result === "object" && result !== null && "error" in result
        ? result.error
        : undefined;
      throw new AppError({
        statusCode: response.status === 404 || response.status === 409 || response.status === 422
          ? response.status
          : response.status === 503 ? 503 : 502,
        code: internalError?.code ?? "SNAPSHOT_OPERATION_FAILED",
        message: internalError?.message ?? "Version history operation failed",
      });
    }
    return result as T;
  }
}
