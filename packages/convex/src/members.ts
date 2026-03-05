import { v } from "convex/values";
import { roles } from "./schema";
import type { Doc } from "./_generated/dataModel";
import { query, mutation } from "./_generated/server";
import {
  Result,
  success,
  failure,
  HttpStatus,
  isFailure,
} from "@beakcrypt/shared";
import { getAuthUser, requireOrgAdmin, requireOrgMember } from "./authHelpers";
import { authComponent } from "./auth";

type AuthUser = NonNullable<
  Awaited<ReturnType<typeof authComponent.getAnyUserById>>
>;

type MemberWithUser = {
  member: Doc<"organizationMembers">;
  user: AuthUser | null;
};

export const list = query({
  args: {
    orgId: v.id("organizations"),
  },
  handler: async (ctx, args): Promise<Result<MemberWithUser[]>> => {
    const authResult = await requireOrgMember(ctx, args.orgId);
    if (isFailure(authResult)) return authResult;

    const memberships = await ctx.db
      .query("organizationMembers")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();

    const members: MemberWithUser[] = [];

    for (const membership of memberships) {
      const user = await authComponent
        .getAnyUserById(ctx, membership.userId)
        .catch(() => null);

      members.push({
        member: membership,
        user,
      });
    }

    return success(members);
  },
});

export const getMyMembership = query({
  args: {
    orgId: v.id("organizations"),
  },
  handler: async (
    ctx,
    args,
  ): Promise<Result<Doc<"organizationMembers"> | null>> => {
    const authResult = await requireOrgMember(ctx, args.orgId);
    if (isFailure(authResult)) return authResult;

    const { membership } = authResult.data;

    return success(membership ?? null);
  },
});

export const updateRole = mutation({
  args: {
    memberId: v.id("organizationMembers"),
    role: roles,
  },
  handler: async (ctx, args): Promise<Result<Doc<"organizationMembers">>> => {
    const membership = await ctx.db.get(args.memberId);
    if (!membership) {
      return failure(
        HttpStatus.NOT_FOUND,
        "member:not_found",
        "Member not found",
      );
    }

    const authResult = await requireOrgAdmin(ctx, membership.orgId);
    if (isFailure(authResult)) return authResult;

    const org = await ctx.db.get(membership.orgId);
    if (org && membership.userId === org.ownerId) {
      return failure(
        HttpStatus.FORBIDDEN,
        "member:cannot_change_owner",
        "Cannot change the organization owner's role",
      );
    }

    if (args.role === "owner") {
      return failure(
        HttpStatus.BAD_REQUEST,
        "member:invalid_role",
        "Cannot assign owner role directly",
      );
    }

    await ctx.db.patch(args.memberId, {
      role: args.role,
      updatedAt: Date.now(),
    });

    const updated = await ctx.db.get(args.memberId);
    if (!updated) {
      return failure(
        HttpStatus.INTERNAL_SERVER_ERROR,
        "member:update_failed",
        "Failed to update member",
      );
    }

    return success(updated);
  },
});

export const remove = mutation({
  args: {
    memberId: v.id("organizationMembers"),
  },
  handler: async (ctx, args): Promise<Result<{ removed: true }>> => {
    const userResult = await getAuthUser(ctx);
    if (isFailure(userResult)) return userResult;

    const membership = await ctx.db.get(args.memberId);
    if (!membership) {
      return failure(
        HttpStatus.NOT_FOUND,
        "member:not_found",
        "Member not found",
      );
    }

    const authResult = await requireOrgAdmin(ctx, membership.orgId);
    if (isFailure(authResult)) return authResult;

    const org = await ctx.db.get(membership.orgId);
    if (org && membership.userId === org.ownerId) {
      return failure(
        HttpStatus.FORBIDDEN,
        "member:cannot_remove_owner",
        "Cannot remove the organization owner",
      );
    }

    const memberKeys = await ctx.db
      .query("memberKeys")
      .withIndex("by_org_and_user", (q) =>
        q.eq("orgId", membership.orgId).eq("userId", membership.userId),
      )
      .collect();

    for (const key of memberKeys) {
      if (key.status !== "revoked") {
        await ctx.db.patch(key._id, {
          status: "revoked",
          wrappedOrgKey: undefined,
          updatedAt: Date.now(),
        });
      }
    }

    await ctx.db.delete(args.memberId);

    return success({ removed: true });
  },
});
