import type { Request, Response } from "express";
import { getRequestMetadata } from "../lib/request-metadata.js";
import { routeParam } from "../lib/route-param.js";
import type { CommentService } from "../services/comment.service.js";

export class CommentController {
  constructor(private readonly service: CommentService) {}

  list = async (request: Request, response: Response): Promise<void> => {
    const query = response.locals.validatedQuery as { includeResolved: boolean };
    const comments = await this.service.list(routeParam(request, "pageId"), this.actor(request), query.includeResolved);
    response.status(200).json({ data: { comments } });
  };

  create = async (request: Request, response: Response): Promise<void> => {
    const comment = await this.service.create(
      routeParam(request, "workspaceId"),
      routeParam(request, "pageId"),
      request.body,
      this.actor(request),
      getRequestMetadata(request),
    );
    response.status(201).json({ data: { comment } });
  };

  reply = async (request: Request, response: Response): Promise<void> => {
    const reply = await this.service.reply(
      routeParam(request, "workspaceId"),
      routeParam(request, "pageId"),
      routeParam(request, "commentId"),
      request.body,
      this.actor(request),
      getRequestMetadata(request),
    );
    response.status(201).json({ data: { reply } });
  };

  status = async (request: Request, response: Response): Promise<void> => {
    const comment = await this.service.setResolved(
      routeParam(request, "workspaceId"),
      routeParam(request, "pageId"),
      routeParam(request, "commentId"),
      request.body.resolved as boolean,
      this.actor(request),
      getRequestMetadata(request),
    );
    response.status(200).json({ data: { comment } });
  };

  deleteComment = async (request: Request, response: Response): Promise<void> => {
    await this.service.deleteComment(
      routeParam(request, "workspaceId"),
      routeParam(request, "pageId"),
      routeParam(request, "commentId"),
      this.actor(request),
      getRequestMetadata(request),
    );
    response.status(204).send();
  };

  deleteReply = async (request: Request, response: Response): Promise<void> => {
    await this.service.deleteReply(
      routeParam(request, "pageId"),
      routeParam(request, "commentId"),
      routeParam(request, "replyId"),
      this.actor(request),
    );
    response.status(204).send();
  };

  private actor(request: Request) {
    return {
      userId: request.auth!.user.id,
      workspaceRole: request.workspaceAccess!.membership.workspaceRole,
      permissions: request.pageAccess!.permissions,
    };
  }
}
