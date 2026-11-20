import { chromium } from "@playwright/test";

const browser = await chromium.launch({ headless: true });
try {
  const customerContext = await browser.newContext();
  const customer = await customerContext.newPage();
  await customer.goto("http://localhost:5174/login", { waitUntil: "domcontentloaded" });
  await customer.getByLabel("Email address").fill("customer@aureva.local");
  await customer.getByLabel("Password").fill("AurevaDemo2026!");
  await customer.getByRole("button", { name: "Sign in" }).click();
  await customer.waitForURL(/\/account$/, { timeout: 15_000 });
  await customer.goto("http://localhost:5174/products");
  await customer.getByRole("link", { name: "Hand-thrown Dune Vase", exact: true }).click();
  await customer.getByRole("button", { name: "Add to bag" }).click();
  await customer.getByText("Added to your bag").waitFor();
  await customer.goto("http://localhost:5174/cart");
  await customer.getByRole("link", { name: "Hand-thrown Dune Vase", exact: true }).waitFor();
  console.log("PASS customer storefront → login → product → persistent cart");
  await customerContext.close();

  const adminContext = await browser.newContext();
  const admin = await adminContext.newPage();
  await admin.goto("http://localhost:5174/login", { waitUntil: "domcontentloaded" });
  await admin.getByLabel("Email address").fill("admin@aureva.local");
  await admin.getByLabel("Password").fill("AurevaDemo2026!");
  await admin.getByRole("button", { name: "Sign in" }).click();
  await admin.waitForURL(/\/account$/, { timeout: 15_000 });
  await admin.goto("http://localhost:5174/admin");
  await admin.getByRole("heading", { name: "AUREVA overview" }).waitFor();
  await admin.getByText("GMV", { exact: true }).waitFor();
  console.log("PASS admin login → protected platform metrics");
  await adminContext.close();
} finally {
  await browser.close();
}
