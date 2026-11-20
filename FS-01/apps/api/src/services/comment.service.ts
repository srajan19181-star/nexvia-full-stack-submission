import { WorkspaceRole, type PrismaClient } from "@nexvia/database";
import {
  activityActions,
  type CreateCommentInput,
  type CreateCommentReplyInput,
  type EffectivePermissions,
} from "@nexvia/shared";
import * as Y from "yjs";
import { conflict, forbidden, notFound } from "../lib/errors.js";
import type { RequestMetadata } from "./auth.service.js";
import { recordActivity } from "./activity.service.js";

export interface CommentActor {
  userId: string;
  workspaceRole: "OWNER" | "ADMIN" | "MEMBER";
  permissions: EffectivePermissions;
}

function encode(value: Uint8Array | null): string | null {
  return value ? Buffer.from(value).toString("base64url") : null;
}

function decode(value: string): Uint8Array<ArrayBuffer> {
  const buffer = Buffer.from(value, "base64url");
  const result = new Uint8Array(buffer.byteLength);
  result.set(buffer);
  return result;
}

export class CommentService {
  constructor(private readonly prisma: PrismaClient) {}

  private serializeComment<T extends {
    anchorStart: Uint8Array | null;
    anchorEnd: Uint8Array | null;
    anchorStateVector: Uint8Array | null;
    authorId: string;
  }>(comment: T, actor: CommentActor) {
    const administrator = actor.workspaceRole === WorkspaceRole.OWNER || actor.workspaceRole === WorkspaceRole.ADMIN;
    return {
      ...comment,
      anchorStart: encode(comment.anchorStart),
      anchorEnd: encode(comment.anchorEnd),
      anchorStateVector: encode(comment.anchorStateVector),
      canDelete: administrator || comment.authorId === actor.userId,
      canResolve: actor.permissions.comment,
    };
  }

  async list(pageId: string, actor: CommentActor, includeResolved: boolean) {
    const comments = await this.prisma.comment.findMany({
      where: {
        pageId,
        deletedAt: null,
        ...(includeResolved ? {} : { resolvedAt: null }),
      },
      orderBy: { createdAt: "asc" },
      include: {
        author: { select: { id: true, name: true, avatarUrl: true } },
        resolvedBy: { select: { id: true, name: true } },
        replies: {
          where: { deletedAt: null },
          orderBy: { createdAt: "asc" },
          include: { author: { select: { id: true, name: true, avatarUrl: true } } },
        },
      },
    });

    return comments.map((comment) => ({
      ...this.serializeComment(comment, actor),
      replies: comment.replies.map((reply) => ({
        ...reply,
        canDelete:
          actor.workspaceRole === WorkspaceRole.OWNER ||
          actor.workspaceRole === WorkspaceRole.ADMIN ||
          reply.authorId === actor.userId,
      })),
    }));
  }

  async create(
    workspaceId: string,
    pageId: string,
    input: CreateCommentInput,
    actor: CommentActor,
    metadata: RequestMetadata,
  ) {
    this.assertCanComment(actor);
    const state = await this.prisma.documentState.findUnique({ where: { pageId } });
    const generation = state?.generation ?? 1;
    let anchorStart: Uint8Array<ArrayBuffer> | undefined;
    let anchorEnd: Uint8Array<ArrayBuffer> | undefined;
    let anchorStateVector: Uint8Array<ArrayBuffer> | undefined;

    if (input.anchor) {
      if (!state) throw conflict("The document must finish synchronizing before adding a range comment", "DOCUMENT_NOT_READY");
      anchorStart = decode(input.anchor.start);
      anchorEnd = decode(input.anchor.end);
      anchorStateVector = decode(input.anchor.stateVector);
      await this.validateAnchor(pageId, generation, state.state, state.compactedThroughUpdateId, anchorStart, anchorEnd, anchorStateVector);
    }

    return this.prisma.$transaction(async (transaction) => {
      const currentState = await transaction.documentState.findUnique({
        where: { pageId },
        select: { generation: true },
      });
      if ((currentState?.generation ?? 1) !== generation) {
        throw conflict("The document changed while the comment was being created", "COMMENT_ANCHOR_STALE");
      }
      const comment = await transaction.comment.create({
        data: {
          pageId,
          authorId: actor.userId,
          body: input.body,
          anchorGeneration: generation,
          ...(anchorStart === undefined ? {} : { anchorStart }),
          ...(anchorEnd === undefined ? {} : { anchorEnd }),
          ...(anchorStateVector === undefined ? {} : { anchorStateVector }),
          ...(input.anchor === undefined ? {} : { anchorQuote: input.anchor.quote }),
        },
        include: { author: { select: { id: true, name: true, avatarUrl: true } } },
      });
      await recordActivity(transaction, {
        workspaceId,
        pageId,
        actorId: actor.userId,
        action: activityActions.commentCreated,
        entityType: "comment",
        entityId: comment.id,
        metadata: { anchored: input.anchor !== undefined },
        ...metadata,
      });
      return this.serializeComment(
        {
          ...comment,
          anchorEnd: comment.anchorEnd,
          anchorStart: comment.anchorStart,
          anchorStateVector: comment.anchorStateVector,
        },
        actor,
      );
    });
  }

  async reply(
    workspaceId: string,
    pageId: string,
    commentId: string,
    input: CreateCommentReplyInput,
    actor: CommentActor,
    metadata: RequestMetadata,
  ) {
    this.assertCanComment(actor);
    const comment = await this.prisma.comment.findFirst({ where: { id: commentId, pageId, deletedAt: null } });
    if (!comment) throw notFound("Comment not found");

    return this.prisma.$transaction(async (transaction) => {
      const reply = await transaction.commentReply.create({
        data: { commentId, authorId: actor.userId, body: input.body },
        include: { author: { select: { id: true, name: true, avatarUrl: true } } },
      });
      await recordActivity(transaction, {
        workspaceId,
        pageId,
        actorId: actor.userId,
        action: activityActions.commentReplied,
        entityType: "comment_reply",
        entityId: reply.id,
        metadata: { commentId },
        ...metadata,
      });
      return reply;
    });
  }

  async setResolved(
    workspaceId: string,
    pageId: string,
    commentId: string,
    resolved: boolean,
    actor: CommentActor,
    metadata: RequestMetadata,
  ) {
    this.assertCanComment(actor);
    const comment = await this.prisma.comment.findFirst({ where: { id: commentId, pageId, deletedAt: null } });
    if (!comment) throw notFound("Comment not found");
    if ((comment.resolvedAt !== null) === resolved) return comment;

    return this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.comment.update({
        where: { id: commentId },
        data: resolved
          ? { resolvedAt: new Date(), resolvedById: actor.userId }
          : { resolvedAt: null, resolvedById: null },
      });
      await recordActivity(transaction, {
        workspaceId,
        pageId,
        actorId: actor.userId,
        action: resolved ? activityActions.commentResolved : activityActions.commentReopened,
        entityType: "comment",
        entityId: commentId,
        ...metadata,
      });
      return updated;
    });
  }

  async deleteComment(
    workspaceId: string,
    pageId: string,
    commentId: string,
    actor: CommentActor,
    metadata: RequestMetadata,
  ): Promise<void> {
    const comment = await this.prisma.comment.findFirst({ where: { id: commentId, pageId, deletedAt: null } });
    if (!comment) throw notFound("Comment not found");
    this.assertCanDelete(actor, comment.authorId);
    await this.prisma.$transaction(async (transaction) => {
      await transaction.comment.update({
        where: { id: commentId },
        data: { deletedAt: new Date(), deletedById: actor.userId },
      });
      await recordActivity(transaction, {
        workspaceId,
        pageId,
        actorId: actor.userId,
        action: activityActions.commentDeleted,
        entityType: "comment",
        entityId: commentId,
        ...metadata,
      });
    });
  }

  async deleteReply(pageId: string, commentId: string, replyId: string, actor: CommentActor): Promise<void> {
    const reply = await this.prisma.commentReply.findFirst({
      where: { id: replyId, commentId, deletedAt: null, comment: { pageId, deletedAt: null } },
    });
    if (!reply) throw notFound("Comment reply not found");
    this.assertCanDelete(actor, reply.authorId);
    await this.prisma.commentReply.update({
      where: { id: replyId },
      data: { deletedAt: new Date(), deletedById: actor.userId },
    });
  }

  private assertCanComment(actor: CommentActor): void {
    if (!actor.permissions.comment) throw forbidden("Comment permission is required");
  }

  private assertCanDelete(actor: CommentActor, authorId: string): void {
    const administrator = actor.workspaceRole === WorkspaceRole.OWNER || actor.workspaceRole === WorkspaceRole.ADMIN;
    if (!administrator && actor.userId !== authorId) throw forbidden("Only the author or a workspace administrator can delete this comment");
  }

  private async validateAnchor(
    pageId: string,
    generation: number,
    compactedState: Uint8Array,
    compactedThroughUpdateId: bigint | null,
    start: Uint8Array,
    end: Uint8Array,
    stateVector: Uint8Array,
  ): Promise<void> {
    try {
      Y.decodeStateVector(stateVector);
      const startPosition = Y.decodeRelativePosition(start);
      const endPosition = Y.decodeRelativePosition(end);
      const document = new Y.Doc();
      try {
        Y.applyUpdate(document, new Uint8Array(compactedState));
        const updates = await this.prisma.documentUpdate.findMany({
          where: {
            pageId,
            generation,
            ...(compactedThroughUpdateId === null ? {} : { id: { gt: compactedThroughUpdateId } }),
          },
          orderBy: { id: "asc" },
          select: { update: true },
        });
        for (const update of updates) Y.applyUpdate(document, new Uint8Array(update.update));
        const startAbsolute = Y.createAbsolutePositionFromRelativePosition(startPosition, document);
        const endAbsolute = Y.createAbsolutePositionFromRelativePosition(endPosition, document);
        if (
          !startAbsolute ||
          !endAbsolute ||
          startAbsolute.type !== endAbsolute.type ||
          startAbsolute.index >= endAbsolute.index
        ) {
          throw new Error("Anchor no longer resolves");
        }
      } finally {
        document.destroy();
      }
    } catch {
      throw conflict("The selected text changed before the comment was created", "COMMENT_ANCHOR_STALE");
    }
  }
}
