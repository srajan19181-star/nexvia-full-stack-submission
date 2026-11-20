import type { Request, Response } from "express";
import { getRequestMetadata } from "../lib/request-metadata.js";
import { routeParam } from "../lib/route-param.js";
import type { HistoryService } from "../services/history.service.js";

export class HistoryController {
  constructor(private readonly service: HistoryService) {}

  list = async (request: Request, response: Response): Promise<void> => {
    const history = await this.service.list(routeParam(request, "pageId"), response.locals.validatedQuery);
    response.status(200).json({ data: history });
  };

  preview = async (request: Request, response: Response): Promise<void> => {
    const snapshot = await this.service.preview(routeParam(request, "pageId"), routeParam(request, "snapshotId"));
    response.status(200).json({ data: { snapshot } });
  };

  create = async (request: Request, response: Response): Promise<void> => {
    const result = await this.service.create(
      routeParam(request, "pageId"),
      request.body,
      request.auth!.user.id,
      getRequestMetadata(request),
    );
    response.status(201).json({ data: result });
  };

  restore = async (request: Request, response: Response): Promise<void> => {
    const result = await this.service.restore(
      routeParam(request, "pageId"),
      routeParam(request, "snapshotId"),
      request.body,
      request.auth!.user.id,
      getRequestMetadata(request),
    );
    response.status(200).json({ data: result });
  };
}
