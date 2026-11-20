import { Router } from "express";
import { prisma } from "@aureva/database";
import { newsletterSchema } from "@aureva/shared";
import { asyncRoute, ok, validate } from "../http";

export const publicRoutes = Router();

publicRoutes.post("/newsletter", asyncRoute(async (request, response) => {
  const input = validate(newsletterSchema, request.body);
  await prisma.newsletterSubscriber.upsert({
    where: { email: input.email },
    create: { email: input.email },
    update: { status: "ACTIVE", unsubscribedAt: null, subscribedAt: new Date() },
  });
  return ok(response, { subscribed: true }, 201);
}));
