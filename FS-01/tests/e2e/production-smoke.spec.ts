import { expect, test } from "@playwright/test";

test("production landing page renders without browser errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().includes("status of 401")) errors.push(message.text());
  });

  await page.goto("/", { waitUntil: "networkidle" });

  await expect(page.getByRole("heading", { name: /ideas move together/i })).toBeVisible();
  expect(errors).toEqual([]);
});
