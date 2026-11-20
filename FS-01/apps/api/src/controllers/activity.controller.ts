import type { Request, Response } from "express";
import { routeParam } from "../lib/route-param.js";
import type { ActivityLogService } from "../services/activity-log.service.js";

export class ActivityController {
  constructor(private readonly service: ActivityLogService) {}

  list = async (request: Request, response: Response): Promise<void> => {
    const query = response.locals.validatedQuery as { limit: number; cursor?: string };
    const activity = await this.service.list(routeParam(request, "workspaceId"), query.limit, query.cursor);
    response.status(200).json({ data: activity });
  };
}
