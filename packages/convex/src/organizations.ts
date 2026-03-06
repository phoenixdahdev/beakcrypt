import { v } from "convex/values";
import { validateSlug } from "@beakcrypt/shared";
import type { Doc } from "./_generated/dataModel";
import { query, mutation } from "./_generated/server";
import { getAuthUser, requireOrgAdmin, requireOrgMember } from "./authHelpers";
import {
  Result,
  success,
  failure,
  HttpStatus,
  isFailure,
} from "@beakcrypt/shared";

export const create = mutation({
  args: {
    name: v.string(),
    slug: v.string(),
    avatar: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Result<Doc<"organizations">>> => {
    const userResult = await getAuthUser(ctx);
    if (isFailure(userResult)) return userResult;

    const user = userResult.data;

    const slugValidation = validateSlug(args.slug);
    if (!slugValidation.valid) {
      return failure(
        HttpStatus.BAD_REQUEST,
        "validation:invalid_slug",
        slugValidation.error ?? "Invalid slug",
      );
    }

    const existing = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();

    if (existing) {
      return failure(
        HttpStatus.CONFLICT,
        "org:slug_taken",
        "Organization URL is already taken",
      );
    }

    const id = await ctx.db.insert("organizations", {
      name: args.name,
      slug: args.slug,
      avatar: args.avatar,
      ownerId: user._id,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    await ctx.db.insert("organizationMembers", {
      orgId: id,
      userId: user._id,
      role: "owner",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    const organization = await ctx.db.get(id);
    if (!organization) {
      return failure(
        HttpStatus.INTERNAL_SERVER_ERROR,
        "org:create_failed",
        "Failed to create organization",
      );
    }

    return success(organization, HttpStatus.CREATED);
  },
});

export const getBySlug = query({
  args: {
    slug: v.string(),
  },
  handler: async (ctx, args): Promise<Result<Doc<"organizations">>> => {
    const userResult = await getAuthUser(ctx);
    if (isFailure(userResult)) return userResult;

    const organization = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();

    if (!organization) {
      return failure(
        HttpStatus.NOT_FOUND,
        "org:not_found",
        "Organization not found",
      );
    }

    const membershipResult = await requireOrgMember(ctx, organization._id);
    if (isFailure(membershipResult)) {
      return failure(
        HttpStatus.NOT_FOUND,
        "org:not_found",
        "Organization not found",
      );
    }

    return success(organization);
  },
});

export const checkSlug = query({
  args: {
    slug: v.string(),
  },
  handler: async (ctx, args): Promise<Result<boolean>> => {
    const userResult = await getAuthUser(ctx);
    if (isFailure(userResult)) return userResult;

    const existing = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();

    return success(!!existing);
  },
});

export const list = query({
  args: {},
  handler: async (ctx): Promise<Result<Doc<"organizations">[]>> => {
    const userResult = await getAuthUser(ctx);
    if (isFailure(userResult)) return userResult;

    const memberships = await ctx.db
      .query("organizationMembers")
      .withIndex("by_user", (q) => q.eq("userId", userResult.data._id))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();

    const orgs = await Promise.all(
      memberships.map(async (member) => {
        return await ctx.db.get(member.orgId);
      }),
    );

    return success(orgs.filter((org) => org !== null));
  },
});

export const update = mutation({
  args: {
    id: v.id("organizations"),
    name: v.optional(v.string()),
    slug: v.optional(v.string()),
    avatar: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Result<Doc<"organizations">>> => {
    const authResult = await requireOrgAdmin(ctx, args.id);
    if (isFailure(authResult)) return authResult;

    const org = await ctx.db.get(args.id);
    if (!org) {
      return failure(
        HttpStatus.NOT_FOUND,
        "org:not_found",
        "Organization not found",
      );
    }

    if (args.slug && args.slug !== org.slug) {
      const slugValidation = validateSlug(args.slug);
      if (!slugValidation.valid) {
        return failure(
          HttpStatus.BAD_REQUEST,
          "validation:invalid_slug",
          slugValidation.error ?? "Invalid slug",
        );
      }

      const existing = await ctx.db
        .query("organizations")
        .withIndex("by_slug", (q) => q.eq("slug", args.slug!))
        .first();

      if (existing && existing._id !== args.id) {
        return failure(
          HttpStatus.CONFLICT,
          "org:slug_taken",
          "Organization URL is already taken",
        );
      }
    }

    const updates: Partial<Doc<"organizations">> = {
      updatedAt: Date.now(),
    };

    if (args.name !== undefined) updates.name = args.name;
    if (args.slug !== undefined) updates.slug = args.slug;
    if (args.avatar !== undefined) updates.avatar = args.avatar;

    await ctx.db.patch(args.id, updates);

    const updated = await ctx.db.get(args.id);
    if (!updated) {
      return failure(
        HttpStatus.INTERNAL_SERVER_ERROR,
        "org:update_failed",
        "Failed to update organization",
      );
    }

    return success(updated);
  },
});
