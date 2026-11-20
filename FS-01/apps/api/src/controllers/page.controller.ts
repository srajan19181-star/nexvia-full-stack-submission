import type { Request, Response } from "express";
import { getRequestMetadata } from "../lib/request-metadata.js";
import { routeParam } from "../lib/route-param.js";
import type { PageService } from "../services/page.service.js";

export class PageController {
  constructor(private readonly service: PageService) {}

  list = async (request: Request, response: Response): Promise<void> => {
    const query = response.locals.validatedQuery as { includeDeleted: boolean };
    const pages = await this.service.list(routeParam(request, "workspaceId"), request.auth!.user.id, query.includeDeleted);
    response.status(200).json({ data: { pages } });
  };

  get = async (request: Request, response: Response): Promise<void> => {
    const page = await this.service.get(
      routeParam(request, "workspaceId"),
      routeParam(request, "pageId"),
      this.actor(request),
    );
    response.status(200).json({ data: { page } });
  };

  create = async (request: Request, response: Response): Promise<void> => {
    const page = await this.service.create(
      routeParam(request, "workspaceId"),
      request.body,
      this.actor(request),
      getRequestMetadata(request),
    );
    response.status(201).json({ data: { page } });
  };

  update = async (request: Request, response: Response): Promise<void> => {
    const page = await this.service.update(
      routeParam(request, "workspaceId"),
      routeParam(request, "pageId"),
      request.body,
      this.actor(request),
      getRequestMetadata(request),
    );
    response.status(200).json({ data: { page } });
  };

  delete = async (request: Request, response: Response): Promise<void> => {
    await this.service.delete(
      routeParam(request, "workspaceId"),
      routeParam(request, "pageId"),
      this.actor(request),
      getRequestMetadata(request),
    );
    response.status(204).send();
  };

  restore = async (request: Request, response: Response): Promise<void> => {
    const page = await this.service.restore(
      routeParam(request, "workspaceId"),
      routeParam(request, "pageId"),
      this.actor(request),
      getRequestMetadata(request),
    );
    response.status(200).json({ data: { page } });
  };

  reorder = async (request: Request, response: Response): Promise<void> => {
    await this.service.reorder(
      routeParam(request, "workspaceId"),
      request.body,
      this.actor(request),
      getRequestMetadata(request),
    );
    response.status(204).send();
  };

  favorite = async (request: Request, response: Response): Promise<void> => {
    await this.service.setFavorite(
      routeParam(request, "workspaceId"),
      routeParam(request, "pageId"),
      request.auth!.user.id,
      true,
    );
    response.status(204).send();
  };

  unfavorite = async (request: Request, response: Response): Promise<void> => {
    await this.service.setFavorite(
      routeParam(request, "workspaceId"),
      routeParam(request, "pageId"),
      request.auth!.user.id,
      false,
    );
    response.status(204).send();
  };

  search = async (request: Request, response: Response): Promise<void> => {
    const query = response.locals.validatedQuery as { q: string; limit: number };
    const results = await this.service.search(request.auth!.user.id, query.q, query.limit);
    response.status(200).json({ data: results });
  };

  private actor(request: Request) {
    return {
      userId: request.auth!.user.id,
      workspaceRole: request.workspaceAccess!.membership.workspaceRole,
      contentRole: request.workspaceAccess!.membership.contentRole,
      ...(request.pageAccess === undefined ? {} : { pageRole: request.pageAccess.pageRole }),
    };
  }
}
