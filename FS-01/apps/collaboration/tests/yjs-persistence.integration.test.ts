import { createDatabaseClient, type PrismaClient } from "@nexvia/database";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as Y from "yjs";
import { YjsPersistence } from "../src/persistence/yjs-persistence.js";

const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ??
  "postgresql://nexvia:nexvia_dev_password@localhost:5432/nexvia_test?schema=public";

describe("durable Yjs persistence", () => {
  let prisma: PrismaClient;
  let userId: string;
  let workspaceId: string;
  let pageId: string;

  beforeAll(async () => {
    prisma = createDatabaseClient({ connectionString: testDatabaseUrl, maxConnections: 2 });
    const user = await prisma.user.create({
      data: {
        email: `yjs-${Date.now()}@example.test`,
        name: "Yjs Persistence User",
        passwordHash: "integration-test-only",
      },
    });
    userId = user.id;
    const workspace = await prisma.workspace.create({
      data: {
        name: "Yjs Persistence Workspace",
        slug: `yjs-${Date.now()}`,
        createdById: user.id,
        members: {
          create: { userId: user.id, workspaceRole: "OWNER", contentRole: "EDITOR" },
        },
      },
    });
    workspaceId = workspace.id;
    const page = await prisma.page.create({
      data: {
        workspaceId: workspace.id,
        title: "Durable document",
        createdById: user.id,
        updatedById: user.id,
      },
    });
    pageId = page.id;
  });

  afterAll(async () => {
    await prisma.workspace.delete({ where: { id: workspaceId } });
    await prisma.user.delete({ where: { id: userId } });
    await prisma.$disconnect();
  });

  it("survives a repository restart and deduplicates replayed updates", async () => {
    const firstProcess = new YjsPersistence(prisma, "persistence-test-a");
    const loaded = await firstProcess.loadDocument(pageId);
    const before = Y.encodeStateVector(loaded.document);
    loaded.document.getText("test-body").insert(0, "Persistent collaborative content");
    const update = Y.encodeStateAsUpdate(loaded.document, before);

    const persisted = await firstProcess.appendUpdate(pageId, loaded.generation, update, userId);
    const duplicate = await firstProcess.appendUpdate(pageId, loaded.generation, update, userId);
    expect(persisted.deduplicated).toBe(false);
    expect(duplicate).toMatchObject({ id: persisted.id, deduplicated: true });
    loaded.document.destroy();

    const restartedProcess = new YjsPersistence(prisma, "persistence-test-b");
    const restarted = await restartedProcess.loadDocument(pageId);
    expect(restarted.document.getText("test-body").toString()).toBe("Persistent collaborative content");
    expect(restarted.lastUpdateId).toBe(persisted.id);
    restarted.document.destroy();
  });

  it("compacts applied updates without losing document state", async () => {
    const persistence = new YjsPersistence(prisma, "persistence-test-compact");
    const loaded = await persistence.loadDocument(pageId);
    const before = Y.encodeStateVector(loaded.document);
    loaded.document.getText("test-body").insert(10, " safely compacted");
    const update = Y.encodeStateAsUpdate(loaded.document, before);
    const persisted = await persistence.appendUpdate(pageId, loaded.generation, update, userId);

    expect(await persistence.compact(pageId, loaded.generation, loaded.document, persisted.id)).toBe(true);
    loaded.document.destroy();

    const reloaded = await new YjsPersistence(prisma, "persistence-test-after-compact").loadDocument(pageId);
    expect(reloaded.document.getText("test-body").toString()).toContain("safely compacted");
    expect(await prisma.documentUpdate.count({ where: { pageId, id: { lte: persisted.id } } })).toBe(0);
    reloaded.document.destroy();
  });

  it("indexes collaborative editor text during durable compaction", async () => {
    const persistence = new YjsPersistence(prisma, "persistence-test-search");
    const loaded = await persistence.loadDocument(pageId);
    const before = Y.encodeStateVector(loaded.document);
    const paragraph = new Y.XmlElement("paragraph");
    const text = new Y.XmlText();
    text.insert(0, "Searchable collaborative knowledge");
    paragraph.insert(0, [text]);
    loaded.document.getXmlFragment("default").insert(0, [paragraph]);
    const update = Y.encodeStateAsUpdate(loaded.document, before);
    const persisted = await persistence.appendUpdate(pageId, loaded.generation, update, userId);

    expect(await persistence.compact(pageId, loaded.generation, loaded.document, persisted.id)).toBe(true);
    expect(await prisma.documentSearchIndex.findUnique({ where: { pageId } })).toMatchObject({
      plainText: "Searchable collaborative knowledge",
    });
    loaded.document.destroy();
  });
});
