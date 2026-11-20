import type { Request, Response } from "express";
import { getRequestMetadata } from "../lib/request-metadata.js";
import { routeParam } from "../lib/route-param.js";
import type { WorkspaceService } from "../services/workspace.service.js";

export class WorkspaceController {
  constructor(private readonly service: WorkspaceService) {}

  list = async (request: Request, response: Response): Promise<void> => {
    const workspaces = await this.service.listForUser(request.auth!.user.id);
    response.status(200).json({ data: { workspaces } });
  };

  create = async (request: Request, response: Response): Promise<void> => {
    const workspace = await this.service.create(request.auth!.user.id, request.body, getRequestMetadata(request));
    response.status(201).json({ data: { workspace } });
  };

  get = async (request: Request, response: Response): Promise<void> => {
    const workspace = await this.service.getOverview(routeParam(request, "workspaceId"), request.auth!.user.id);
    response.status(200).json({ data: { workspace } });
  };

  rename = async (request: Request, response: Response): Promise<void> => {
    const workspace = await this.service.rename(
      routeParam(request, "workspaceId"),
      request.body,
      this.actor(request),
      getRequestMetadata(request),
    );
    response.status(200).json({ data: { workspace } });
  };

  delete = async (request: Request, response: Response): Promise<void> => {
    await this.service.delete(routeParam(request, "workspaceId"), this.actor(request));
    response.status(204).send();
  };

  listMembers = async (request: Request, response: Response): Promise<void> => {
    const members = await this.service.listMembers(routeParam(request, "workspaceId"));
    response.status(200).json({ data: { members } });
  };

  updateMember = async (request: Request, response: Response): Promise<void> => {
    const member = await this.service.updateMember(
      routeParam(request, "workspaceId"),
      routeParam(request, "memberId"),
      request.body,
      this.actor(request),
      getRequestMetadata(request),
    );
    response.status(200).json({ data: { member } });
  };

  removeMember = async (request: Request, response: Response): Promise<void> => {
    await this.service.removeMember(
      routeParam(request, "workspaceId"),
      routeParam(request, "memberId"),
      this.actor(request),
      getRequestMetadata(request),
    );
    response.status(204).send();
  };

  listInvitations = async (request: Request, response: Response): Promise<void> => {
    const invitations = await this.service.listInvitations(routeParam(request, "workspaceId"), this.actor(request));
    response.status(200).json({ data: { invitations } });
  };

  invite = async (request: Request, response: Response): Promise<void> => {
    const invitation = await this.service.invite(
      routeParam(request, "workspaceId"),
      request.body,
      this.actor(request),
      getRequestMetadata(request),
    );
    response.status(201).json({ data: { invitation } });
  };

  revokeInvitation = async (request: Request, response: Response): Promise<void> => {
    await this.service.revokeInvitation(
      routeParam(request, "workspaceId"),
      routeParam(request, "invitationId"),
      this.actor(request),
      getRequestMetadata(request),
    );
    response.status(204).send();
  };

  acceptInvitation = async (request: Request, response: Response): Promise<void> => {
    const result = await this.service.acceptInvitation(
      request.body.token,
      request.auth!.user.id,
      request.auth!.user.email,
      getRequestMetadata(request),
    );
    response.status(200).json({ data: result });
  };

  rejectInvitation = async (request: Request, response: Response): Promise<void> => {
    const result = await this.service.rejectInvitation(
      request.body.token,
      request.auth!.user.id,
      request.auth!.user.email,
      getRequestMetadata(request),
    );
    response.status(200).json({ data: result });
  };

  private actor(request: Request) {
    return {
      userId: request.auth!.user.id,
      name: request.auth!.user.name,
      workspaceRole: request.workspaceAccess!.membership.workspaceRole,
    };
  }
}
