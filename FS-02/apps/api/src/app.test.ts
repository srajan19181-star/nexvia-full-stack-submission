import { describe, expect, it, vi } from "vitest";
import request from "supertest";

vi.mock("@aureva/database", () => ({ prisma: { $queryRaw: vi.fn().mockResolvedValue([{ "?column?": 1 }]) } }));
describe("API infrastructure", () => {
  it("returns health metadata", async () => { const { createApp } = await import("./app"); const response = await request(createApp()).get("/health"); expect(response.status).toBe(200); expect(response.body.data.status).toBe("healthy"); });
  it("returns structured 404 errors", async () => { const { createApp } = await import("./app"); const response = await request(createApp()).get("/missing"); expect(response.status).toBe(404); expect(response.body.error.code).toBe("NOT_FOUND"); });
});
