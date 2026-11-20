import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill("AurevaDemo2026!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/account$/);
}

test("customer discovers a product and updates the persistent cart drawer", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Objects");
  await signIn(page, "customer@aureva.local");
  await page.goto("/products");
  await page.getByRole("link", { name: "Hand-thrown Dune Vase", exact: true }).first().click();
  await expect(page.getByRole("heading", { name: "Hand-thrown Dune Vase" })).toBeVisible();
  await page.getByRole("button", { name: "Add to bag" }).click();
  await expect(page.getByRole("dialog", { name: "Shopping bag" })).toBeVisible();
  await expect(page.getByText("Hand-thrown Dune Vase", { exact: true }).last()).toBeVisible();
  await page.getByRole("button", { name: "Close shopping bag" }).click();
  await page.goto("/cart");
  await expect(page.getByRole("heading", { name: "Shopping bag" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Hand-thrown Dune Vase", exact: true })).toBeVisible();
});

test("vendor role opens products and live analytics", async ({ page }) => {
  await signIn(page, "vendor@aureva.local");
  await page.goto("/vendor-portal");
  await expect(page.getByRole("heading", { name: /welcome, mitti & form/i })).toBeVisible();
  await page.goto("/vendor-portal/products");
  await expect(page.getByRole("heading", { name: "Products" })).toBeVisible();
  await page.goto("/vendor-portal/analytics");
  await expect(page.getByRole("heading", { name: "Store analytics" })).toBeVisible();
});

test("admin role opens protected customers and platform metrics", async ({ page }) => {
  await signIn(page, "admin@aureva.local");
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "AUREVA overview" })).toBeVisible();
  await expect(page.getByText("GMV", { exact: true })).toBeVisible();
  await page.goto("/admin/customers");
  await expect(page.getByRole("heading", { name: "Customer management" })).toBeVisible();
  await expect(page.getByText("customer@aureva.local")).toBeVisible();
});

test("mobile storefront navigation remains usable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Open menu" }).click();
  const navigation = page.getByRole("navigation", { name: "Mobile navigation" });
  await expect(navigation).toBeVisible();
  await navigation.getByRole("link", { name: "Shop all" }).click();
  await expect(page).toHaveURL(/\/products$/);
  await expect(page.getByRole("heading", { name: "Shop all" })).toBeVisible();
});

test("representative public pages have no automatic WCAG A/AA violations", async ({ page }) => {
  for (const path of ["/", "/products", "/login"]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
    expect(results.violations, `${path}: ${results.violations.map((violation) => violation.id).join(", ")}`).toEqual([]);
  }
});
