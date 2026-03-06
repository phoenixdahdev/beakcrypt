import { authComponent } from "./auth";
import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx, MutationCtx } from "./_generated/server";
import {
  Result,
  success,
  failure,
  HttpStatus,
  isFailure,
} from "@beakcrypt/shared";

type AuthCtx = QueryCtx | MutationCtx;

export type AuthUser = NonNullable<
  Awaited<ReturnType<typeof authComponent.getAuthUser>>
>;

export async function getAuthUser(ctx: AuthCtx): Promise<Result<AuthUser>> {
  const user = await authComponent.getAuthUser(ctx).catch(() => null);
  if (!user) {
    return failure(
      HttpStatus.UNAUTHORIZED,
      "auth:unauthorized",
      "You must be logged in",
    );
  }
  return success(user, HttpStatus.OK);
}

async function checkMembership(
  ctx: AuthCtx,
  orgId: Id<"organizations">,
  userId: string,
): Promise<Result<Doc<"organizationMembers">>> {
  const membership = await ctx.db
    .query("organizationMembers")
    .withIndex("by_org_and_user", (q) =>
      q.eq("orgId", orgId).eq("userId", userId),
    )
    .filter((q) => q.eq(q.field("deletedAt"), undefined))
    .first();

  if (!membership) {
    return failure(
      HttpStatus.FORBIDDEN,
      "org:not_member",
      "You are not a member of this organization",
    );
  }

  return success(membership);
}

function checkAdminRole(
  membership: Doc<"organizationMembers">,
): Result<Doc<"organizationMembers">> {
  if (membership.role !== "owner" && membership.role !== "admin") {
    return failure(
      HttpStatus.FORBIDDEN,
      "auth:insufficient_permissions",
      "You are not authorized to perform this action",
    );
  }
  return success(membership);
}

type OrgAuthResult = { user: AuthUser; membership: Doc<"organizationMembers"> };

export async function requireOrgAdmin(
  ctx: AuthCtx,
  orgId: Id<"organizations">,
): Promise<Result<OrgAuthResult>> {
  const userResult = await getAuthUser(ctx);
  if (isFailure(userResult)) {
    return userResult;
  }

  const membershipResult = await checkMembership(
    ctx,
    orgId,
    userResult.data._id,
  );
  if (isFailure(membershipResult)) {
    return membershipResult;
  }

  const roleResult = checkAdminRole(membershipResult.data);
  if (isFailure(roleResult)) {
    return roleResult;
  }

  return success({
    user: userResult.data,
    membership: membershipResult.data,
  });
}

export async function requireOrgMember(
  ctx: AuthCtx,
  orgId: Id<"organizations">,
): Promise<Result<OrgAuthResult>> {
  const userResult = await getAuthUser(ctx);
  if (isFailure(userResult)) {
    return userResult;
  }

  const membershipResult = await checkMembership(
    ctx,
    orgId,
    userResult.data._id,
  );
  if (isFailure(membershipResult)) {
    return membershipResult;
  }

  return success({
    user: userResult.data,
    membership: membershipResult.data,
  });
}
