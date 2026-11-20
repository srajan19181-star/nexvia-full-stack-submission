import { ContentRole, type PrismaClient, WorkspaceRole } from "@nexvia/database";
import {
  activityActions,
  calculateEffectivePermissions,
  type CreatePageInput,
  type ReorderPagesInput,
  type UpdatePageInput,
} from "@nexvia/shared";
import { conflict, forbidden, notFound } from "../lib/errors.js";
import type { RequestMetadata } from "./auth.service.js";
import { recordActivity } from "./activity.service.js";

export interface PageActor {
  userId: string;
  workspaceRole: WorkspaceRole;
  contentRole: ContentRole;
  pageRole?: ContentRole | null;
}

export class PageService {
  constructor(private readonly prisma: PrismaClient) {}

  async list(workspaceId: string, userId: string, includeDeleted: boolean) {
    const pages = await this.prisma.page.findMany({
      where: { workspaceId, ...(includeDeleted ? {} : { deletedAt: null }) },
      orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
      include: {
        favorites: { where: { userId }, select: { userId: true } },
      },
    });
    return pages.map(({ favorites, ...page }) => ({ ...page, isFavorite: favorites.length > 0 }));
  }

  async get(workspaceId: string, pageId: string, actor: PageActor) {
    const page = await this.prisma.page.findFirst({
      where: { id: pageId, workspaceId },
      include: {
        favorites: { where: { userId: actor.userId }, select: { userId: true } },
        documentState: { select: { generation: true } },
      },
    });
    if (!page) {
      throw notFound("Page not found");
    }
    const { favorites, documentState, ...data } = page;
    return {
      ...data,
      isFavorite: favorites.length > 0,
      documentGeneration: documentState?.generation ?? 1,
      permissions: calculateEffectivePermissions(actor),
    };
  }

  async create(
    workspaceId: string,
    input: CreatePageInput,
    actor: PageActor,
    metadata: RequestMetadata,
  ) {
    this.assertCanEdit(actor);
    const parentId = input.parentId ?? null;
    await this.assertValidParent(workspaceId, undefined, parentId);
    const lastSibling = await this.prisma.page.findFirst({
      where: { workspaceId, parentId, deletedAt: null },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });

    return this.prisma.$transaction(async (transaction) => {
      const page = await transaction.page.create({
        data: {
          workspaceId,
          title: input.title,
          parentId,
          sortOrder: (lastSibling?.sortOrder ?? -1) + 1,
          createdById: actor.userId,
          updatedById: actor.userId,
          ...(input.icon === undefined ? {} : { icon: input.icon }),
        },
      });
      await recordActivity(transaction, {
        workspaceId,
        pageId: page.id,
        actorId: actor.userId,
        action: activityActions.pageCreated,
        entityType: "page",
        entityId: page.id,
        metadata: { title: page.title, parentId: page.parentId },
        ...metadata,
      });
      return page;
    });
  }

  async update(
    workspaceId: string,
    pageId: string,
    input: UpdatePageInput,
    actor: PageActor,
    metadata: RequestMetadata,
  ) {
    this.assertCanEdit(actor);
    const current = await this.prisma.page.findFirst({ where: { id: pageId, workspaceId, deletedAt: null } });
    if (!current) {
      throw notFound("Page not found");
    }
    if (input.parentId !== undefined) {
      await this.assertValidParent(workspaceId, pageId, input.parentId);
    }

    const moved = input.parentId !== undefined && input.parentId !== current.parentId;
    let sortOrder = current.sortOrder;
    if (moved) {
      const destinationParentId = input.parentId as string | null;
      const sibling = await this.prisma.page.findFirst({
        where: { workspaceId, parentId: destinationParentId, deletedAt: null },
        orderBy: { sortOrder: "desc" },
        select: { sortOrder: true },
      });
      sortOrder = (sibling?.sortOrder ?? -1) + 1;
    }

    return this.prisma.$transaction(async (transaction) => {
      const page = await transaction.page.update({
        where: { id: pageId },
        data: {
          ...(input.title === undefined ? {} : { title: input.title }),
          ...(input.parentId === undefined ? {} : { parentId: input.parentId }),
          ...(input.icon === undefined ? {} : { icon: input.icon }),
          ...(input.coverUrl === undefined ? {} : { coverUrl: input.coverUrl }),
          ...(moved ? { sortOrder } : {}),
          updatedById: actor.userId,
        },
      });
      if (input.title !== undefined && input.title !== current.title) {
        await recordActivity(transaction, {
          workspaceId,
          pageId,
          actorId: actor.userId,
          action: activityActions.pageRenamed,
          entityType: "page",
          entityId: pageId,
          metadata: { previousTitle: current.title, title: page.title },
          ...metadata,
        });
      }
      if (moved) {
        await recordActivity(transaction, {
          workspaceId,
          pageId,
          actorId: actor.userId,
          action: activityActions.pageMoved,
          entityType: "page",
          entityId: pageId,
          metadata: { previousParentId: current.parentId, parentId: page.parentId },
          ...metadata,
        });
      }
      return page;
    });
  }

  async delete(
    workspaceId: string,
    pageId: string,
    actor: PageActor,
    metadata: RequestMetadata,
  ): Promise<void> {
    this.assertCanEdit(actor);
    const page = await this.prisma.page.findFirst({ where: { id: pageId, workspaceId, deletedAt: null } });
    if (!page) {
      throw notFound("Page not found");
    }
    const allPages = await this.prisma.page.findMany({
      where: { workspaceId, deletedAt: null },
      select: { id: true, parentId: true },
    });
    const ids = this.collectDescendants(pageId, allPages);
    const deletedAt = new Date();
    await this.prisma.$transaction(async (transaction) => {
      await transaction.page.updateMany({
        where: { id: { in: ids }, workspaceId },
        data: { deletedAt, deletedById: actor.userId, updatedById: actor.userId },
      });
      await recordActivity(transaction, {
        workspaceId,
        pageId,
        actorId: actor.userId,
        action: activityActions.pageDeleted,
        entityType: "page",
        entityId: pageId,
        metadata: { title: page.title, descendantCount: ids.length - 1 },
        ...metadata,
      });
    });
  }

  async restore(
    workspaceId: string,
    pageId: string,
    actor: PageActor,
    metadata: RequestMetadata,
  ) {
    this.assertCanEdit(actor);
    const page = await this.prisma.page.findFirst({ where: { id: pageId, workspaceId, deletedAt: { not: null } } });
    if (!page?.deletedAt) {
      throw notFound("Deleted page not found");
    }
    const allPages = await this.prisma.page.findMany({
      where: { workspaceId },
      select: { id: true, parentId: true, deletedAt: true },
    });
    const subtree = this.collectDescendants(pageId, allPages);
    const ids = subtree.filter((id) => {
      const candidate = allPages.find((item) => item.id === id);
      return candidate?.deletedAt?.getTime() === page.deletedAt?.getTime();
    });
    const parentIsDeleted = page.parentId
      ? allPages.some((candidate) => candidate.id === page.parentId && candidate.deletedAt !== null && !ids.includes(candidate.id))
      : false;

    return this.prisma.$transaction(async (transaction) => {
      await transaction.page.updateMany({
        where: { id: { in: ids }, workspaceId },
        data: { deletedAt: null, deletedById: null, updatedById: actor.userId },
      });
      const restored = parentIsDeleted
        ? await transaction.page.update({ where: { id: pageId }, data: { parentId: null } })
        : await transaction.page.findUniqueOrThrow({ where: { id: pageId } });
      await recordActivity(transaction, {
        workspaceId,
        pageId,
        actorId: actor.userId,
        action: activityActions.pageRestored,
        entityType: "page",
        entityId: pageId,
        metadata: { title: restored.title, restoredCount: ids.length },
        ...metadata,
      });
      return restored;
    });
  }

  async reorder(
    workspaceId: string,
    input: ReorderPagesInput,
    actor: PageActor,
    metadata: RequestMetadata,
  ): Promise<void> {
    this.assertCanEdit(actor);
    if (new Set(input.orderedPageIds).size !== input.orderedPageIds.length) {
      throw conflict("Page order contains duplicate IDs", "INVALID_PAGE_ORDER");
    }
    await this.assertValidParent(workspaceId, undefined, input.parentId);
    const siblings = await this.prisma.page.findMany({
      where: { workspaceId, parentId: input.parentId, deletedAt: null },
      select: { id: true },
    });
    const actualIds = siblings.map((page) => page.id).sort();
    const requestedIds = [...input.orderedPageIds].sort();
    if (actualIds.length !== requestedIds.length || actualIds.some((id, index) => id !== requestedIds[index])) {
      throw conflict("Page order must contain every active sibling exactly once", "INVALID_PAGE_ORDER");
    }

    await this.prisma.$transaction(async (transaction) => {
      await Promise.all(
        input.orderedPageIds.map((id, sortOrder) =>
          transaction.page.update({ where: { id }, data: { sortOrder, updatedById: actor.userId } }),
        ),
      );
      await recordActivity(transaction, {
        workspaceId,
        actorId: actor.userId,
        action: activityActions.pageMoved,
        entityType: "page_order",
        metadata: { parentId: input.parentId, orderedPageIds: input.orderedPageIds },
        ...metadata,
      });
    });
  }

  async setFavorite(workspaceId: string, pageId: string, userId: string, favorite: boolean): Promise<void> {
    const page = await this.prisma.page.findFirst({ where: { id: pageId, workspaceId, deletedAt: null } });
    if (!page) {
      throw notFound("Page not found");
    }
    if (favorite) {
      await this.prisma.pageFavorite.upsert({
        where: { userId_pageId: { userId, pageId } },
        create: { userId, pageId },
        update: {},
      });
      return;
    }
    await this.prisma.pageFavorite.deleteMany({ where: { userId, pageId } });
  }

  async search(userId: string, query: string, limit: number) {
    const [pages, workspaces] = await Promise.all([
      this.prisma.page.findMany({
        where: {
          deletedAt: null,
          workspace: { members: { some: { userId } } },
          OR: [
            { title: { contains: query, mode: "insensitive" } },
            { searchIndex: { plainText: { contains: query, mode: "insensitive" } } },
          ],
        },
        take: limit,
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          title: true,
          icon: true,
          workspaceId: true,
          updatedAt: true,
          workspace: { select: { name: true } },
        },
      }),
      this.prisma.workspace.findMany({
        where: {
          name: { contains: query, mode: "insensitive" },
          members: { some: { userId } },
        },
        take: limit,
        orderBy: { updatedAt: "desc" },
        select: { id: true, name: true, slug: true, updatedAt: true },
      }),
    ]);
    return { pages, workspaces };
  }

  private assertCanEdit(actor: PageActor): void {
    if (!calculateEffectivePermissions(actor).edit) {
      throw forbidden("Editor permission is required");
    }
  }

  private async assertValidParent(workspaceId: string, pageId: string | undefined, parentId: string | null): Promise<void> {
    if (!parentId) {
      return;
    }
    if (pageId === parentId) {
      throw conflict("A page cannot be its own parent", "INVALID_PAGE_PARENT");
    }
    const parent = await this.prisma.page.findFirst({
      where: { id: parentId, workspaceId, deletedAt: null },
      select: { parentId: true },
    });
    if (!parent) {
      throw notFound("Parent page not found");
    }
    let current: { parentId: string | null } = parent;
    for (let depth = 0; current.parentId; depth += 1) {
      if (depth > 100) {
        throw conflict("Page nesting is too deep", "INVALID_PAGE_PARENT");
      }
      if (current.parentId === pageId) {
        throw conflict("Moving this page would create a cycle", "INVALID_PAGE_PARENT");
      }
      const nextParentId = current.parentId;
      const next: { parentId: string | null } | null = await this.prisma.page.findFirst({
        where: { id: nextParentId, workspaceId, deletedAt: null },
        select: { parentId: true },
      });
      if (!next) {
        break;
      }
      current = next;
    }
  }

  private collectDescendants(
    rootId: string,
    pages: Array<{ id: string; parentId: string | null }>,
  ): string[] {
    const ids = [rootId];
    for (let index = 0; index < ids.length; index += 1) {
      const parentId = ids[index]!;
      for (const page of pages) {
        if (page.parentId === parentId && !ids.includes(page.id)) {
          ids.push(page.id);
        }
      }
    }
    return ids;
  }
}
