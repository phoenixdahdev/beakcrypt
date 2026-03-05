import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { query, mutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import {
  Result,
  success,
  failure,
  HttpStatus,
  isFailure,
} from "@beakcrypt/shared";
import { getAuthUser, requireOrgAdmin, requireOrgMember } from "./authHelpers";

async function syncSecretsFromDev(
  ctx: MutationCtx,
  projectId: Id<"projects">,
  targetEnvId: Id<"environments">,
  userId: string,
) {
  const devEnv = await ctx.db
    .query("environments")
    .withIndex("by_project_and_name", (q) =>
      q.eq("projectId", projectId).eq("name", "development"),
    )
    .filter((q) =>
      q.and(
        q.or(
          q.eq(q.field("isPersonal"), false),
          q.eq(q.field("isPersonal"), undefined),
        ),
        q.eq(q.field("deletedAt"), undefined),
      ),
    )
    .first();

  if (!devEnv) return;

  const devSecrets = await ctx.db
    .query("secrets")
    .withIndex("by_environment", (q) => q.eq("environmentId", devEnv._id))
    .filter((q) => q.eq(q.field("deletedAt"), undefined))
    .collect();

  for (const secret of devSecrets) {
    await ctx.db.insert("secrets", {
      key: secret.key,
      encryptedValue: secret.encryptedValue,
      environmentId: targetEnvId,
      createdBy: userId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  }
}

export const list = query({
  args: {
    projectId: v.id("projects"),
  },
  handler: async (ctx, args): Promise<Result<Doc<"environments">[]>> => {
    const userResult = await getAuthUser(ctx);
    if (isFailure(userResult)) return userResult;

    const project = await ctx.db.get(args.projectId);
    if (!project) {
      return failure(
        HttpStatus.NOT_FOUND,
        "project:not_found",
        "Project not found",
      );
    }

    const authResult = await requireOrgMember(ctx, project.orgId);
    if (isFailure(authResult)) return authResult;

    const allEnvironments = await ctx.db
      .query("environments")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();

    const userId = userResult.data._id;
    const visible = allEnvironments.filter(
      (env) => !env.isPersonal || env.ownerId === userId,
    );

    return success(visible.sort((a, b) => a.order - b.order));
  },
});

export const ensurePersonalLocal = mutation({
  args: {
    projectId: v.id("projects"),
    syncFromDev: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<Result<Doc<"environments">>> => {
    const userResult = await getAuthUser(ctx);
    if (isFailure(userResult)) return userResult;

    const project = await ctx.db.get(args.projectId);
    if (!project) {
      return failure(
        HttpStatus.NOT_FOUND,
        "project:not_found",
        "Project not found",
      );
    }

    const authResult = await requireOrgMember(ctx, project.orgId);
    if (isFailure(authResult)) return authResult;

    const userId = userResult.data._id;

    const existing = await ctx.db
      .query("environments")
      .withIndex("by_project_and_owner", (q) =>
        q.eq("projectId", args.projectId).eq("ownerId", userId),
      )
      .filter((q) =>
        q.and(
          q.eq(q.field("name"), "local"),
          q.eq(q.field("deletedAt"), undefined),
        ),
      )
      .first();

    if (existing) {
      if (args.syncFromDev !== false) {
        const existingSecrets = await ctx.db
          .query("secrets")
          .withIndex("by_environment", (q) =>
            q.eq("environmentId", existing._id),
          )
          .first();

        if (!existingSecrets) {
          await syncSecretsFromDev(ctx, args.projectId, existing._id, userId);
        }
      }
      return success(existing);
    }

    const envId = await ctx.db.insert("environments", {
      name: "local",
      projectId: args.projectId,
      order: 0,
      isPersonal: true,
      ownerId: userId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    if (args.syncFromDev !== false) {
      await syncSecretsFromDev(ctx, args.projectId, envId, userId);
    }

    const environment = await ctx.db.get(envId);
    if (!environment) {
      return failure(
        HttpStatus.INTERNAL_SERVER_ERROR,
        "env:create_failed",
        "Failed to create personal environment",
      );
    }

    return success(environment, HttpStatus.CREATED);
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    projectId: v.id("projects"),
  },
  handler: async (ctx, args): Promise<Result<Doc<"environments">>> => {
    const userResult = await getAuthUser(ctx);
    if (isFailure(userResult)) return userResult;

    const project = await ctx.db.get(args.projectId);
    if (!project) {
      return failure(
        HttpStatus.NOT_FOUND,
        "project:not_found",
        "Project not found",
      );
    }

    const authResult = await requireOrgAdmin(ctx, project.orgId);
    if (isFailure(authResult)) return authResult;

    if (args.name.toLowerCase() === "local") {
      return failure(
        HttpStatus.CONFLICT,
        "env:reserved_name",
        '"local" is reserved for personal environments',
      );
    }

    const environments = await ctx.db
      .query("environments")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();

    const existing = environments.find(
      (env) =>
        !env.isPersonal && env.name.toLowerCase() === args.name.toLowerCase(),
    );

    if (existing) {
      return failure(
        HttpStatus.CONFLICT,
        "env:name_taken",
        "An environment with this name already exists",
      );
    }

    const sharedEnvs = environments.filter((env) => !env.isPersonal);
    const maxOrder = Math.max(...sharedEnvs.map((env) => env.order), -1);

    const envId = await ctx.db.insert("environments", {
      name: args.name,
      projectId: args.projectId,
      order: maxOrder + 1,
      isPersonal: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    const environment = await ctx.db.get(envId);
    if (!environment) {
      return failure(
        HttpStatus.INTERNAL_SERVER_ERROR,
        "env:create_failed",
        "Failed to create environment",
      );
    }

    return success(environment, HttpStatus.CREATED);
  },
});

export const update = mutation({
  args: {
    id: v.id("environments"),
    name: v.optional(v.string()),
    order: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<Result<Doc<"environments">>> => {
    const userResult = await getAuthUser(ctx);
    if (isFailure(userResult)) return userResult;

    const environment = await ctx.db.get(args.id);
    if (!environment) {
      return failure(
        HttpStatus.NOT_FOUND,
        "env:not_found",
        "Environment not found",
      );
    }

    if (environment.isPersonal && environment.ownerId !== userResult.data._id) {
      return failure(
        HttpStatus.FORBIDDEN,
        "env:not_owner",
        "You can only modify your own personal environment",
      );
    }

    if (environment.isPersonal && args.name && args.name !== environment.name) {
      return failure(
        HttpStatus.BAD_REQUEST,
        "env:cannot_rename_personal",
        "Personal environments cannot be renamed",
      );
    }

    const project = await ctx.db.get(environment.projectId);
    if (!project) {
      return failure(
        HttpStatus.NOT_FOUND,
        "project:not_found",
        "Project not found",
      );
    }

    if (!environment.isPersonal) {
      const authResult = await requireOrgAdmin(ctx, project.orgId);
      if (isFailure(authResult)) return authResult;
    } else {
      const authResult = await requireOrgMember(ctx, project.orgId);
      if (isFailure(authResult)) return authResult;
    }

    if (args.name && args.name !== environment.name) {
      const newName = args.name;

      if (newName.toLowerCase() === "local") {
        return failure(
          HttpStatus.CONFLICT,
          "env:reserved_name",
          '"local" is reserved for personal environments',
        );
      }

      const environments = await ctx.db
        .query("environments")
        .withIndex("by_project", (q) =>
          q.eq("projectId", environment.projectId),
        )
        .filter((q) => q.eq(q.field("deletedAt"), undefined))
        .collect();

      const existing = environments.find(
        (env) =>
          env._id !== args.id &&
          !env.isPersonal &&
          env.name.toLowerCase() === newName.toLowerCase(),
      );

      if (existing) {
        return failure(
          HttpStatus.CONFLICT,
          "env:name_taken",
          "An environment with this name already exists",
        );
      }
    }

    await ctx.db.patch(args.id, {
      ...(args.name && { name: args.name }),
      ...(args.order !== undefined && { order: args.order }),
      updatedAt: Date.now(),
    });

    const updated = await ctx.db.get(args.id);
    if (!updated) {
      return failure(
        HttpStatus.INTERNAL_SERVER_ERROR,
        "env:update_failed",
        "Failed to update environment",
      );
    }

    return success(updated);
  },
});

export const remove = mutation({
  args: {
    id: v.id("environments"),
  },
  handler: async (ctx, args): Promise<Result<{ deleted: true }>> => {
    const userResult = await getAuthUser(ctx);
    if (isFailure(userResult)) return userResult;

    const environment = await ctx.db.get(args.id);
    if (!environment) {
      return failure(
        HttpStatus.NOT_FOUND,
        "env:not_found",
        "Environment not found",
      );
    }

    if (environment.isPersonal && environment.ownerId !== userResult.data._id) {
      return failure(
        HttpStatus.FORBIDDEN,
        "env:not_owner",
        "You can only delete your own personal environment",
      );
    }

    const project = await ctx.db.get(environment.projectId);
    if (!project) {
      return failure(
        HttpStatus.NOT_FOUND,
        "project:not_found",
        "Project not found",
      );
    }

    if (!environment.isPersonal) {
      const authResult = await requireOrgAdmin(ctx, project.orgId);
      if (isFailure(authResult)) return authResult;
    } else {
      const authResult = await requireOrgMember(ctx, project.orgId);
      if (isFailure(authResult)) return authResult;
    }

    const secrets = await ctx.db
      .query("secrets")
      .withIndex("by_environment", (q) => q.eq("environmentId", args.id))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();

    const now = Date.now();
    for (const secret of secrets) {
      await ctx.db.patch(secret._id, { deletedAt: now });
    }

    await ctx.db.patch(args.id, { deletedAt: now });

    return success({ deleted: true });
  },
});
