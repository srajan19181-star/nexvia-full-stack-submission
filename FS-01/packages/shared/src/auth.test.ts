import { describe, expect, it } from "vitest";
import { registerInputSchema } from "./auth.js";

describe("registerInputSchema", () => {
  it("normalizes an email and accepts a strong password", () => {
    const result = registerInputSchema.parse({
      name: "  Ada Lovelace  ",
      email: "  ADA@EXAMPLE.COM ",
      password: "Analytical!1843",
    });

    expect(result).toEqual({
      name: "Ada Lovelace",
      email: "ada@example.com",
      password: "Analytical!1843",
    });
  });

  it("rejects passwords without the full policy", () => {
    const result = registerInputSchema.safeParse({
      name: "Ada Lovelace",
      email: "ada@example.com",
      password: "weakpassword",
    });

    expect(result.success).toBe(false);
  });
});
