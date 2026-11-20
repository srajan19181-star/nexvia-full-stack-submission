import type { Request, Response } from "express";
import { getRequestMetadata } from "../lib/request-metadata.js";
import { routeParam } from "../lib/route-param.js";
import type { PagePermissionService } from "../services/page-permission.service.js";

export class PagePermissionController {
  constructor(private readonly service: PagePermissionService) {}

  list = async (request: Request, response: Response): Promise<void> => {
    const permissions = await this.service.list(
      routeParam(request, "workspaceId"),
      routeParam(request, "pageId"),
    );
    response.status(200).json({ data: { permissions } });
  };

  set = async (request: Request, response: Response): Promise<void> => {
    const permission = await this.service.set(
      routeParam(request, "workspaceId"),
      routeParam(request, "pageId"),
      routeParam(request, "memberId"),
      request.body,
      request.auth!.user.id,
      getRequestMetadata(request),
    );
    response.status(200).json({ data: { permission } });
  };

  remove = async (request: Request, response: Response): Promise<void> => {
    await this.service.remove(
      routeParam(request, "workspaceId"),
      routeParam(request, "pageId"),
      routeParam(request, "memberId"),
      request.auth!.user.id,
      getRequestMetadata(request),
    );
    response.status(204).send();
  };
}
