import "dotenv/config";
import argon2 from "argon2";
import { ContentRole, WorkspaceRole } from "../generated/prisma/client.js";
import { createDatabaseClient } from "../src/client.js";

const prisma = createDatabaseClient();

async function seed(): Promise<void> {
  if (process.env.NODE_ENV !== "development" || process.env.SEED_DEMO_DATA !== "true") {
    console.info("Demo seed skipped. Set NODE_ENV=development and SEED_DEMO_DATA=true to enable it.");
    return;
  }

  const passwordHash = await argon2.hash("DemoWorkspace!2026", {
    type: argon2.argon2id,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
  });

  const user = await prisma.user.upsert({
    where: { email: "demo@nexvia.local" },
    update: { name: "Demo Collaborator", passwordHash },
    create: {
      email: "demo@nexvia.local",
      name: "Demo Collaborator",
      passwordHash,
    },
  });

  const workspace = await prisma.workspace.upsert({
    where: { slug: "demo-workspace" },
    update: { name: "Demo Workspace" },
    create: {
      name: "Demo Workspace",
      slug: "demo-workspace",
      createdById: user.id,
    },
  });

  await prisma.workspaceMember.upsert({
    where: {
      workspaceId_userId: {
        workspaceId: workspace.id,
        userId: user.id,
      },
    },
    update: {
      workspaceRole: WorkspaceRole.OWNER,
      contentRole: ContentRole.EDITOR,
    },
    create: {
      workspaceId: workspace.id,
      userId: user.id,
      workspaceRole: WorkspaceRole.OWNER,
      contentRole: ContentRole.EDITOR,
    },
  });

  console.info("Development demo account created: demo@nexvia.local");
}

seed()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
