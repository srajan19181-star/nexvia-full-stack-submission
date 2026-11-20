import { createDatabaseClient } from "@nexvia/database";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";

const testDatabaseUrl = process.env.TEST_DATABASE_URL
  ?? "postgresql://nexvia:nexvia_dev_password@localhost:5432/nexvia_test?schema=public";
const prisma = createDatabaseClient({ connectionString: testDatabaseUrl, maxConnections: 2 });

async function register(context: BrowserContext, identity: { name: string; email: string }): Promise<{ page: Page; userId: string }> {
  const page = await context.newPage();
  await page.goto("/register");
  await page.getByLabel("Full name").fill(identity.name);
  await page.getByLabel("Work email").fill(identity.email);
  await page.getByLabel("Password", { exact: true }).fill("SecurePassword!2026");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  const response = await page.request.get("http://127.0.0.1:4100/api/v1/auth/me");
  expect(response.ok()).toBeTruthy();
  const body = await response.json() as { data: { user: { id: string } } };
  return { page, userId: body.data.user.id };
}

test.describe.serial("real-time collaborative workspace", () => {
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const ownerEmail = `owner-${runId}@example.test`;
  const collaboratorEmail = `collaborator-${runId}@example.test`;
  let workspaceId = "";
  let pageId = "";
  let ownerId = "";
  let collaboratorId = "";

  test.afterAll(async () => {
    if (workspaceId) await prisma.workspace.deleteMany({ where: { id: workspaceId } });
    await prisma.user.deleteMany({ where: { id: { in: [ownerId, collaboratorId].filter(Boolean) } } });
    await prisma.$disconnect();
  });

  test("registers two users, converges edits, reconnects, and enforces viewer access", async ({ browser }) => {
    const ownerContext = await browser.newContext();
    const collaboratorContext = await browser.newContext();
    const owner = await register(ownerContext, { name: "E2E Owner", email: ownerEmail });
    const collaborator = await register(collaboratorContext, { name: "E2E Collaborator", email: collaboratorEmail });
    ownerId = owner.userId;
    collaboratorId = collaborator.userId;

    try {
      await owner.page.bringToFront();
      await owner.page.getByLabel("Open recent activity").click();
      const notificationPanel = owner.page.getByTestId("notification-panel");
      await expect(notificationPanel).toBeVisible();
      const panelBox = await notificationPanel.boundingBox();
      expect(panelBox).not.toBeNull();
      const panelIsTopmost = await owner.page.evaluate(({ x, y }) => {
        return document.elementFromPoint(x, y)?.closest('[data-testid="notification-panel"]') !== null;
      }, { x: panelBox!.x + panelBox!.width / 2, y: panelBox!.y + 24 });
      expect(panelIsTopmost).toBe(true);
      await owner.page.getByLabel("Open recent activity").click();

      await owner.page.getByRole("button", { name: "Create workspace" }).first().click();
      const workspaceDialog = owner.page.getByRole("dialog", { name: "Create a workspace" });
      await workspaceDialog.getByLabel("Workspace name").fill(`E2E Workspace ${runId}`);
      await workspaceDialog.getByRole("button", { name: "Create workspace", exact: true }).click();
      await expect(owner.page).toHaveURL(/\/workspace\/[^/]+$/);
      workspaceId = owner.page.url().split("/").at(-1)!;

      await owner.page.getByRole("button", { name: "New page" }).click();
      await expect(owner.page).toHaveURL(/\/workspace\/[^/]+\/page\/[^/]+$/);
      pageId = owner.page.url().split("/").at(-1)!;

      await prisma.workspaceMember.create({
        data: {
          workspaceId,
          userId: collaboratorId,
          workspaceRole: "MEMBER",
          contentRole: "EDITOR",
        },
      });

      await collaborator.page.goto(`/workspace/${workspaceId}/page/${pageId}`);
      const ownerEditor = owner.page.getByLabel("Document content");
      const collaboratorEditor = collaborator.page.getByLabel("Document content");
      await expect(ownerEditor).toHaveAttribute("contenteditable", "true");
      await expect(collaboratorEditor).toHaveAttribute("contenteditable", "true");

      await Promise.all([
        ownerEditor.pressSequentially("Owner contribution ", { delay: 8 }),
        collaboratorEditor.pressSequentially("Collaborator contribution ", { delay: 8 }),
      ]);
      await expect(ownerEditor).toContainText("Owner contribution");
      await expect(ownerEditor).toContainText("Collaborator contribution");
      await expect(collaboratorEditor).toContainText("Owner contribution");
      await expect(collaboratorEditor).toContainText("Collaborator contribution");

      await collaboratorContext.setOffline(true);
      await collaboratorEditor.pressSequentially("offline edit ", { delay: 8 });
      await ownerEditor.pressSequentially("online edit ", { delay: 8 });
      await collaboratorContext.setOffline(false);
      await expect(ownerEditor).toContainText("offline edit", { timeout: 20_000 });
      await expect(collaboratorEditor).toContainText("online edit", { timeout: 20_000 });

      await prisma.workspaceMember.update({
        where: { workspaceId_userId: { workspaceId, userId: collaboratorId } },
        data: { contentRole: "VIEWER" },
      });
      await collaborator.page.reload();
      await expect(collaborator.page.getByLabel("Document content")).toHaveAttribute("contenteditable", "false");
      await expect(collaborator.page.getByText("Read only", { exact: true })).toBeVisible();
    } finally {
      await ownerContext.close();
      await collaboratorContext.close();
    }
  });
});
