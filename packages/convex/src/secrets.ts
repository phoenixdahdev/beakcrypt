import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { query, mutation } from "./_generated/server";
import type { QueryCtx, MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import {
  Result,
  success,
  failure,
  HttpStatus,
  isFailure,
} from "@beakcrypt/shared";
import { getAuthUser, requireOrgAdmin, requireOrgMember } from "./authHelpers";

async function requireEnvWriteAccess(
  ctx: QueryCtx | MutationCtx,
  environmentId: Id<"environments">,
) {
  const userResult = await getAuthUser(ctx);
  if (isFailure(userResult)) return { ok: false as const, result: userResult };

  const environment = await ctx.db.get(environmentId);
  if (!environment || environment.deletedAt !== undefined) {
    return {
      ok: false as const,
      result: failure(
        HttpStatus.NOT_FOUND,
        "env:not_found",
        "Environment not found",
      ),
    };
  }

  const project = await ctx.db.get(environment.projectId);
  if (!project) {
    return {
      ok: false as const,
      result: failure(
        HttpStatus.NOT_FOUND,
        "project:not_found",
        "Project not found",
      ),
    };
  }

  if (environment.isPersonal) {
    if (environment.ownerId !== userResult.data._id) {
      return {
        ok: false as const,
        result: failure(
          HttpStatus.FORBIDDEN,
          "env:not_owner",
          "You can only manage secrets in your own personal environment",
        ),
      };
    }
    const authResult = await requireOrgMember(ctx, project.orgId);
    if (isFailure(authResult)) {
      return { ok: false as const, result: authResult };
    }
    return { ok: true as const, user: userResult.data, project, environment };
  }

  const authResult = await requireOrgAdmin(ctx, project.orgId);
  if (isFailure(authResult)) {
    return { ok: false as const, result: authResult };
  }
  return { ok: true as const, user: userResult.data, project, environment };
}

export const list = query({
  args: {
    environmentId: v.id("environments"),
  },
  handler: async (ctx, args): Promise<Result<Doc<"secrets">[]>> => {
    const userResult = await getAuthUser(ctx);
    if (isFailure(userResult)) return userResult;

    const environment = await ctx.db.get(args.environmentId);
    if (!environment || environment.deletedAt !== undefined) {
      return failure(
        HttpStatus.NOT_FOUND,
        "env:not_found",
        "Environment not found",
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

    if (environment.isPersonal && environment.ownerId !== userResult.data._id) {
      return failure(
        HttpStatus.FORBIDDEN,
        "env:not_owner",
        "You cannot view secrets in another user's personal environment",
      );
    }

    const authResult = await requireOrgMember(ctx, project.orgId);
    if (isFailure(authResult)) return authResult;

    const secrets = await ctx.db
      .query("secrets")
      .withIndex("by_environment", (q) =>
        q.eq("environmentId", args.environmentId),
      )
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();

    return success(secrets);
  },
});

export const create = mutation({
  args: {
    environmentId: v.id("environments"),
    key: v.string(),
    encryptedValue: v.string(),
  },
  handler: async (ctx, args): Promise<Result<Doc<"secrets">>> => {
    const access = await requireEnvWriteAccess(ctx, args.environmentId);
    if (!access.ok) return access.result;

    if (args.key.trim().length === 0) {
      return failure(
        HttpStatus.BAD_REQUEST,
        "secret:invalid_key",
        "Secret key cannot be empty",
      );
    }

    const existing = await ctx.db
      .query("secrets")
      .withIndex("by_env_and_key", (q) =>
        q.eq("environmentId", args.environmentId).eq("key", args.key),
      )
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .first();

    if (existing) {
      return failure(
        HttpStatus.CONFLICT,
        "secret:key_taken",
        "A secret with this key already exists",
      );
    }

    const secretId = await ctx.db.insert("secrets", {
      key: args.key,
      encryptedValue: args.encryptedValue,
      environmentId: args.environmentId,
      createdBy: access.user._id,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    const secret = await ctx.db.get(secretId);
    if (!secret) {
      return failure(
        HttpStatus.INTERNAL_SERVER_ERROR,
        "secret:create_failed",
        "Failed to create secret",
      );
    }

    return success(secret, HttpStatus.CREATED);
  },
});

export const update = mutation({
  args: {
    id: v.id("secrets"),
    key: v.optional(v.string()),
    encryptedValue: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Result<Doc<"secrets">>> => {
    const userResult = await getAuthUser(ctx);
    if (isFailure(userResult)) return userResult;

    const secret = await ctx.db.get(args.id);
    if (!secret || secret.deletedAt !== undefined) {
      return failure(
        HttpStatus.NOT_FOUND,
        "secret:not_found",
        "Secret not found",
      );
    }

    const access = await requireEnvWriteAccess(ctx, secret.environmentId);
    if (!access.ok) return access.result;

    if (args.key !== undefined && args.key !== secret.key) {
      const newKey = args.key;
      const existing = await ctx.db
        .query("secrets")
        .withIndex("by_env_and_key", (q) =>
          q.eq("environmentId", secret.environmentId).eq("key", newKey),
        )
        .filter((q) => q.eq(q.field("deletedAt"), undefined))
        .first();

      if (existing) {
        return failure(
          HttpStatus.CONFLICT,
          "secret:key_taken",
          "A secret with this key already exists",
        );
      }
    }

    await ctx.db.patch(args.id, {
      ...(args.key !== undefined && { key: args.key }),
      ...(args.encryptedValue !== undefined && {
        encryptedValue: args.encryptedValue,
      }),
      updatedAt: Date.now(),
    });

    const updated = await ctx.db.get(args.id);
    if (!updated) {
      return failure(
        HttpStatus.INTERNAL_SERVER_ERROR,
        "secret:update_failed",
        "Failed to update secret",
      );
    }

    return success(updated);
  },
});

export const remove = mutation({
  args: {
    id: v.id("secrets"),
  },
  handler: async (ctx, args): Promise<Result<{ deleted: true }>> => {
    const userResult = await getAuthUser(ctx);
    if (isFailure(userResult)) return userResult;

    const secret = await ctx.db.get(args.id);
    if (!secret || secret.deletedAt !== undefined) {
      return failure(
        HttpStatus.NOT_FOUND,
        "secret:not_found",
        "Secret not found",
      );
    }

    const access = await requireEnvWriteAccess(ctx, secret.environmentId);
    if (!access.ok) return access.result;

    await ctx.db.patch(args.id, {
      deletedAt: Date.now(),
      updatedAt: Date.now(),
    });

    return success({ deleted: true });
  },
});

export const removeAll = mutation({
  args: {
    environmentId: v.id("environments"),
  },
  handler: async (ctx, args): Promise<Result<{ deleted: number }>> => {
    const access = await requireEnvWriteAccess(ctx, args.environmentId);
    if (!access.ok) return access.result;

    const secrets = await ctx.db
      .query("secrets")
      .withIndex("by_environment", (q) =>
        q.eq("environmentId", args.environmentId),
      )
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();

    const now = Date.now();
    for (const secret of secrets) {
      await ctx.db.patch(secret._id, {
        deletedAt: now,
        updatedAt: now,
      });
    }

    return success({ deleted: secrets.length });
  },
});

type BulkCreateResult = {
  created: number;
  updated: number;
  skipped: number;
};

export const bulkCreate = mutation({
  args: {
    environmentId: v.id("environments"),
    secrets: v.array(
      v.object({
        key: v.string(),
        encryptedValue: v.string(),
      }),
    ),
    overwrite: v.optional(v.boolean()),
    decryptedSecrets: v.optional(
      v.array(v.object({ key: v.string(), value: v.string() })),
    ),
  },
  handler: async (ctx, args): Promise<Result<BulkCreateResult>> => {
    const access = await requireEnvWriteAccess(ctx, args.environmentId);
    if (!access.ok) return access.result;

    const results: BulkCreateResult = {
      created: 0,
      updated: 0,
      skipped: 0,
    };

    for (const secret of args.secrets) {
      const existing = await ctx.db
        .query("secrets")
        .withIndex("by_env_and_key", (q) =>
          q.eq("environmentId", args.environmentId).eq("key", secret.key),
        )
        .filter((q) => q.eq(q.field("deletedAt"), undefined))
        .first();

      if (existing) {
        if (args.overwrite) {
          await ctx.db.patch(existing._id, {
            encryptedValue: secret.encryptedValue,
            updatedAt: Date.now(),
          });
          results.updated++;
        } else {
          results.skipped++;
        }
      } else {
        await ctx.db.insert("secrets", {
          key: secret.key,
          encryptedValue: secret.encryptedValue,
          environmentId: args.environmentId,
          createdBy: access.user._id,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
        results.created++;
      }
    }

    // Fire deployment hooks if decrypted secrets were provided
    if (
      args.decryptedSecrets &&
      args.decryptedSecrets.length > 0 &&
      (results.created > 0 || results.updated > 0)
    ) {
      const hooks = await ctx.db
        .query("deploymentHooks")
        .withIndex("by_environment", (q) =>
          q.eq("environmentId", args.environmentId),
        )
        .collect();

      for (const hook of hooks) {
        await ctx.scheduler.runAfter(
          0,
          internal.providers.vercel.syncToVercel,
          {
            hookId: hook._id,
            decryptedSecrets: args.decryptedSecrets,
          },
        );
      }
    }

    return success(results);
  },
});

type SyncResult = {
  created: number;
  updated: number;
  skipped: number;
};

export const syncFromEnvironment = mutation({
  args: {
    sourceEnvironmentId: v.id("environments"),
    targetEnvironmentId: v.id("environments"),
    overwrite: v.boolean(),
  },
  handler: async (ctx, args): Promise<Result<SyncResult>> => {
    const userResult = await getAuthUser(ctx);
    if (isFailure(userResult)) return userResult;

    const sourceEnv = await ctx.db.get(args.sourceEnvironmentId);
    if (!sourceEnv) {
      return failure(
        HttpStatus.NOT_FOUND,
        "env:source_not_found",
        "Source environment not found",
      );
    }

    const targetEnv = await ctx.db.get(args.targetEnvironmentId);
    if (!targetEnv) {
      return failure(
        HttpStatus.NOT_FOUND,
        "env:target_not_found",
        "Target environment not found",
      );
    }

    if (sourceEnv.projectId !== targetEnv.projectId) {
      return failure(
        HttpStatus.BAD_REQUEST,
        "env:project_mismatch",
        "Environments must be in the same project",
      );
    }

    if (sourceEnv.isPersonal && sourceEnv.ownerId !== userResult.data._id) {
      return failure(
        HttpStatus.FORBIDDEN,
        "env:not_owner",
        "You cannot sync from another user's personal environment",
      );
    }

    const access = await requireEnvWriteAccess(ctx, args.targetEnvironmentId);
    if (!access.ok) return access.result;

    const sourceSecrets = await ctx.db
      .query("secrets")
      .withIndex("by_environment", (q) =>
        q.eq("environmentId", args.sourceEnvironmentId),
      )
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();

    const results: SyncResult = {
      created: 0,
      updated: 0,
      skipped: 0,
    };

    for (const secret of sourceSecrets) {
      const existing = await ctx.db
        .query("secrets")
        .withIndex("by_env_and_key", (q) =>
          q.eq("environmentId", args.targetEnvironmentId).eq("key", secret.key),
        )
        .filter((q) => q.eq(q.field("deletedAt"), undefined))
        .first();

      if (existing) {
        if (args.overwrite) {
          await ctx.db.patch(existing._id, {
            encryptedValue: secret.encryptedValue,
            updatedAt: Date.now(),
          });
          results.updated++;
        } else {
          results.skipped++;
        }
      } else {
        await ctx.db.insert("secrets", {
          key: secret.key,
          encryptedValue: secret.encryptedValue,
          environmentId: args.targetEnvironmentId,
          createdBy: access.user._id,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
        results.created++;
      }
    }

    return success(results);
  },
});

export const listAllOrgSecrets = query({
  args: {
    orgId: v.id("organizations"),
  },
  handler: async (
    ctx,
    args,
  ): Promise<Result<Array<{ secretId: string; encryptedValue: string }>>> => {
    const authResult = await requireOrgAdmin(ctx, args.orgId);
    if (isFailure(authResult)) return authResult;

    const projects = await ctx.db
      .query("projects")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();

    const allSecrets: Array<{ secretId: string; encryptedValue: string }> = [];

    for (const project of projects) {
      const environments = await ctx.db
        .query("environments")
        .withIndex("by_project", (q) => q.eq("projectId", project._id))
        .collect();

      for (const env of environments) {
        if (env.isPersonal) continue;

        const secrets = await ctx.db
          .query("secrets")
          .withIndex("by_environment", (q) => q.eq("environmentId", env._id))
          .filter((q) => q.eq(q.field("deletedAt"), undefined))
          .collect();

        for (const secret of secrets) {
          allSecrets.push({
            secretId: secret._id,
            encryptedValue: secret.encryptedValue,
          });
        }
      }
    }

    return success(allSecrets);
  },
});
