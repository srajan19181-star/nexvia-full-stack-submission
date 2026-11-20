import type { Request, Response } from "express";
import type { DashboardService } from "../services/dashboard.service.js";

export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  get = async (request: Request, response: Response): Promise<void> => {
    const dashboard = await this.service.get(request.auth!.user.id);
    response.status(200).json({ data: dashboard });
  };
}
