import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { query, mutation, internalQuery } from "./_generated/server";
import {
  Result,
  success,
  failure,
  HttpStatus,
  isFailure,
} from "@beakcrypt/shared";
import { requireOrgAdmin } from "./authHelpers";

async function requireHookAccess(
  ctx: Parameters<typeof requireOrgAdmin>[0],
  environmentId: Id<"environments">,
) {
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
  if (!project || project.deletedAt !== undefined) {
    return {
      ok: false as const,
      result: failure(
        HttpStatus.NOT_FOUND,
        "project:not_found",
        "Project not found",
      ),
    };
  }

  const authResult = await requireOrgAdmin(ctx, project.orgId);
  if (isFailure(authResult)) {
    return { ok: false as const, result: authResult };
  }

  return {
    ok: true as const,
    user: authResult.data.user,
    project,
    environment,
  };
}

export const create = mutation({
  args: {
    environmentId: v.id("environments"),
    providerProjectId: v.string(),
    providerTeamId: v.optional(v.string()),
    vercelApiToken: v.string(),
    targetEnvironment: v.union(
      v.literal("production"),
      v.literal("preview"),
      v.literal("development"),
    ),
    triggerRedeploy: v.boolean(),
  },
  handler: async (ctx, args): Promise<Result<Doc<"deploymentHooks">>> => {
    const access = await requireHookAccess(ctx, args.environmentId);
    if (!access.ok) return access.result;

    if (!args.providerProjectId.trim()) {
      return failure(
        HttpStatus.BAD_REQUEST,
        "hook:invalid_project_id",
        "Vercel project ID cannot be empty",
      );
    }

    if (!args.vercelApiToken.trim()) {
      return failure(
        HttpStatus.BAD_REQUEST,
        "hook:invalid_token",
        "Vercel API token cannot be empty",
      );
    }

    const hookId = await ctx.db.insert("deploymentHooks", {
      projectId: access.project._id,
      environmentId: args.environmentId,
      provider: "vercel",
      providerProjectId: args.providerProjectId.trim(),
      providerTeamId: args.providerTeamId?.trim() || undefined,
      vercelApiToken: args.vercelApiToken.trim(),
      targetEnvironment: args.targetEnvironment,
      triggerRedeploy: args.triggerRedeploy,
      createdBy: access.user._id,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    const hook = await ctx.db.get(hookId);
    if (!hook) {
      return failure(
        HttpStatus.INTERNAL_SERVER_ERROR,
        "hook:create_failed",
        "Failed to create deployment hook",
      );
    }

    return success(hook, HttpStatus.CREATED);
  },
});

export const list = query({
  args: {
    environmentId: v.id("environments"),
  },
  handler: async (ctx, args): Promise<Result<Doc<"deploymentHooks">[]>> => {
    const access = await requireHookAccess(ctx, args.environmentId);
    if (!access.ok) return access.result;

    const hooks = await ctx.db
      .query("deploymentHooks")
      .withIndex("by_environment", (q) =>
        q.eq("environmentId", args.environmentId),
      )
      .collect();

    return success(hooks);
  },
});

export const listByProject = query({
  args: {
    projectId: v.id("projects"),
  },
  handler: async (ctx, args): Promise<Result<Doc<"deploymentHooks">[]>> => {
    const project = await ctx.db.get(args.projectId);
    if (!project || project.deletedAt !== undefined) {
      return failure(
        HttpStatus.NOT_FOUND,
        "project:not_found",
        "Project not found",
      );
    }

    const authResult = await requireOrgAdmin(ctx, project.orgId);
    if (isFailure(authResult)) return authResult;

    const hooks = await ctx.db
      .query("deploymentHooks")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    return success(hooks);
  },
});

export const update = mutation({
  args: {
    id: v.id("deploymentHooks"),
    providerProjectId: v.optional(v.string()),
    providerTeamId: v.optional(v.string()),
    vercelApiToken: v.optional(v.string()),
    targetEnvironment: v.optional(
      v.union(
        v.literal("production"),
        v.literal("preview"),
        v.literal("development"),
      ),
    ),
    triggerRedeploy: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<Result<Doc<"deploymentHooks">>> => {
    const hook = await ctx.db.get(args.id);
    if (!hook) {
      return failure(
        HttpStatus.NOT_FOUND,
        "hook:not_found",
        "Deployment hook not found",
      );
    }

    const access = await requireHookAccess(ctx, hook.environmentId);
    if (!access.ok) return access.result;

    if (
      args.providerProjectId !== undefined &&
      !args.providerProjectId.trim()
    ) {
      return failure(
        HttpStatus.BAD_REQUEST,
        "hook:invalid_project_id",
        "Vercel project ID cannot be empty",
      );
    }

    if (args.vercelApiToken !== undefined && !args.vercelApiToken.trim()) {
      return failure(
        HttpStatus.BAD_REQUEST,
        "hook:invalid_token",
        "Vercel API token cannot be empty",
      );
    }

    await ctx.db.patch(args.id, {
      ...(args.providerProjectId !== undefined && {
        providerProjectId: args.providerProjectId.trim(),
      }),
      ...(args.providerTeamId !== undefined && {
        providerTeamId: args.providerTeamId.trim() || undefined,
      }),
      ...(args.vercelApiToken !== undefined && {
        vercelApiToken: args.vercelApiToken.trim(),
      }),
      ...(args.targetEnvironment !== undefined && {
        targetEnvironment: args.targetEnvironment,
      }),
      ...(args.triggerRedeploy !== undefined && {
        triggerRedeploy: args.triggerRedeploy,
      }),
      updatedAt: Date.now(),
    });

    const updated = await ctx.db.get(args.id);
    if (!updated) {
      return failure(
        HttpStatus.INTERNAL_SERVER_ERROR,
        "hook:update_failed",
        "Failed to update deployment hook",
      );
    }

    return success(updated);
  },
});

export const remove = mutation({
  args: {
    id: v.id("deploymentHooks"),
  },
  handler: async (ctx, args): Promise<Result<{ deleted: true }>> => {
    const hook = await ctx.db.get(args.id);
    if (!hook) {
      return failure(
        HttpStatus.NOT_FOUND,
        "hook:not_found",
        "Deployment hook not found",
      );
    }

    const access = await requireHookAccess(ctx, hook.environmentId);
    if (!access.ok) return access.result;

    await ctx.db.delete(args.id);

    return success({ deleted: true });
  },
});

// Internal query used by Convex actions (e.g. providers/vercel.ts)
export const getHookById = internalQuery({
  args: {
    id: v.id("deploymentHooks"),
  },
  handler: async (ctx, args): Promise<Doc<"deploymentHooks"> | null> => {
    return await ctx.db.get(args.id);
  },
});
