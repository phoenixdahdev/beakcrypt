import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { query, mutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import {
  Result,
  success,
  failure,
  HttpStatus,
  isFailure,
} from "@beakcrypt/shared";
import { getAuthUser, requireOrgAdmin, requireOrgMember } from "./authHelpers";
import { authComponent, createAuth } from "./auth";

export const registerKey = mutation({
  args: {
    orgId: v.id("organizations"),
    publicKey: v.string(),
    wrappedOrgKey: v.optional(v.string()),
    sessionToken: v.string(),
  },
  handler: async (ctx, args): Promise<Result<Doc<"memberKeys">>> => {
    const userResult = await getAuthUser(ctx);
    if (isFailure(userResult)) return userResult;

    const user = userResult.data;

    const membershipResult = await requireOrgMember(ctx, args.orgId);
    if (isFailure(membershipResult)) return membershipResult;

    const org = await ctx.db.get(args.orgId);
    if (!org) {
      return failure(
        HttpStatus.NOT_FOUND,
        "org:not_found",
        "Organization not found",
      );
    }

    const isOwner = org.ownerId === user._id;
    const isOwnerOrAdmin =
      isOwner || membershipResult.data.membership.role === "admin";

    let status: "active" | "pending" = "pending";
    if (isOwnerOrAdmin && args.wrappedOrgKey) {
      const activeKeyWithOrgKey = await ctx.db
        .query("memberKeys")
        .withIndex("by_org_and_status", (q) =>
          q.eq("orgId", args.orgId).eq("status", "active"),
        )
        .filter((q) => q.neq(q.field("wrappedOrgKey"), undefined))
        .first();

      if (!activeKeyWithOrgKey) {
        status = "active";
      }
    }

    const existingMatches = await ctx.db
      .query("memberKeys")
      .withIndex("by_org_user_publicKey", (q) =>
        q
          .eq("orgId", args.orgId)
          .eq("userId", user._id)
          .eq("publicKey", args.publicKey),
      )
      .filter((q) => q.neq(q.field("status"), "revoked"))
      .take(2);

    if (existingMatches.length > 1) {
      console.error(
        "Duplicate memberKeys detected for org/user/publicKey",
        args.orgId,
        user._id,
        args.publicKey,
      );
      return failure(
        HttpStatus.CONFLICT,
        "key:duplicate",
        "A duplicate key record exists; please contact support",
      );
    }

    if (existingMatches.length === 1) {
      const existing = existingMatches[0]!;

      const patch: Partial<Doc<"memberKeys">> = {};

      if (existing.sessionToken !== args.sessionToken) {
        patch.sessionToken = args.sessionToken;
      }

      if (
        status === "active" &&
        existing.status === "pending" &&
        args.wrappedOrgKey
      ) {
        patch.status = "active";
        patch.wrappedOrgKey = args.wrappedOrgKey;
      }

      if (Object.keys(patch).length > 0) {
        patch.updatedAt = Date.now();
        await ctx.db.patch(existing._id, patch);
        const updated = await ctx.db.get(existing._id);
        return success(updated ?? existing);
      }

      return success(existing);
    }

    const keyId = await ctx.db.insert("memberKeys", {
      orgId: args.orgId,
      userId: user._id,
      publicKey: args.publicKey,
      wrappedOrgKey: status === "active" ? args.wrappedOrgKey : undefined,
      sessionToken: args.sessionToken,
      status,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    const record = await ctx.db.get(keyId);
    if (!record) {
      return failure(
        HttpStatus.INTERNAL_SERVER_ERROR,
        "key:create_failed",
        "Failed to register key",
      );
    }

    if (status === "pending" && org.slug) {
      const existingKeys = await ctx.db
        .query("memberKeys")
        .withIndex("by_org_and_user", (q) =>
          q.eq("orgId", args.orgId).eq("userId", user._id),
        )
        .collect();

      const otherKeys = existingKeys.filter((k) => k._id !== keyId);
      const isNewDevice = otherKeys.length > 0;

      if (isNewDevice) {
        await ctx.scheduler.runAfter(0, internal.mail.sendSessionApprovalMail, {
          userEmail: user.email,
          orgName: org.name,
          orgSlug: org.slug,
          keyId: keyId,
        });
      } else {
        const allMembers = await ctx.db
          .query("organizationMembers")
          .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
          .filter((q) => q.eq(q.field("deletedAt"), undefined))
          .collect();

        const adminMembers = allMembers.filter(
          (m) => m.role === "owner" || m.role === "admin",
        );

        const adminEmails: string[] = [];
        for (const m of adminMembers) {
          const activeKey = await ctx.db
            .query("memberKeys")
            .withIndex("by_org_and_user", (q) =>
              q.eq("orgId", args.orgId).eq("userId", m.userId),
            )
            .filter((q) =>
              q.and(
                q.eq(q.field("status"), "active"),
                q.neq(q.field("wrappedOrgKey"), undefined),
              ),
            )
            .first();

          if (!activeKey) continue;

          const adminUser = await authComponent
            .getAnyUserById(ctx, m.userId)
            .catch(() => null);
          if (adminUser?.email) {
            adminEmails.push(adminUser.email);
          }
        }

        if (adminEmails.length > 0) {
          await ctx.scheduler.runAfter(0, internal.mail.sendKeyApprovalMail, {
            memberEmail: user.email,
            orgName: org.name,
            orgSlug: org.slug,
            keyId: keyId,
            adminEmails,
          });
        }
      }
    }

    return success(record, HttpStatus.CREATED);
  },
});

export const getKeyById = query({
  args: {
    keyId: v.id("memberKeys"),
  },
  handler: async (ctx, args): Promise<Result<Doc<"memberKeys">>> => {
    const userResult = await getAuthUser(ctx);
    if (isFailure(userResult)) return userResult;

    const key = await ctx.db.get(args.keyId);
    if (!key) {
      return failure(
        HttpStatus.NOT_FOUND,
        "key:not_found",
        "Key record not found",
      );
    }

    const membershipResult = await requireOrgMember(ctx, key.orgId);
    if (isFailure(membershipResult)) return membershipResult;

    return success(key);
  },
});

export const approveKey = mutation({
  args: {
    keyId: v.id("memberKeys"),
    wrappedOrgKey: v.string(),
  },
  handler: async (ctx, args): Promise<Result<Doc<"memberKeys">>> => {
    const memberKey = await ctx.db.get(args.keyId);
    if (!memberKey) {
      return failure(
        HttpStatus.NOT_FOUND,
        "key:not_found",
        "Key record not found",
      );
    }

    const authResult = await requireOrgAdmin(ctx, memberKey.orgId);
    if (isFailure(authResult)) return authResult;

    if (memberKey.status !== "pending") {
      return failure(
        HttpStatus.BAD_REQUEST,
        "key:not_pending",
        "Only pending keys can be approved",
      );
    }

    await ctx.db.patch(args.keyId, {
      wrappedOrgKey: args.wrappedOrgKey,
      status: "active",
      updatedAt: Date.now(),
    });

    const updated = await ctx.db.get(args.keyId);
    if (!updated) {
      return failure(
        HttpStatus.INTERNAL_SERVER_ERROR,
        "key:approve_failed",
        "Failed to approve key",
      );
    }

    return success(updated);
  },
});

export const revokeKey = mutation({
  args: {
    keyId: v.id("memberKeys"),
  },
  handler: async (ctx, args): Promise<Result<Doc<"memberKeys">>> => {
    const memberKey = await ctx.db.get(args.keyId);
    if (!memberKey) {
      return failure(
        HttpStatus.NOT_FOUND,
        "key:not_found",
        "Key record not found",
      );
    }

    const authResult = await requireOrgAdmin(ctx, memberKey.orgId);
    if (isFailure(authResult)) return authResult;

    if (memberKey.status === "revoked") {
      return failure(
        HttpStatus.BAD_REQUEST,
        "key:already_revoked",
        "Key is already revoked",
      );
    }

    await ctx.db.patch(args.keyId, {
      status: "revoked",
      wrappedOrgKey: undefined,
      updatedAt: Date.now(),
    });

    const updated = await ctx.db.get(args.keyId);
    if (!updated) {
      return failure(
        HttpStatus.INTERNAL_SERVER_ERROR,
        "key:revoke_failed",
        "Failed to revoke key",
      );
    }

    return success(updated);
  },
});

export const getMyKey = query({
  args: {
    orgId: v.id("organizations"),
    publicKey: v.string(),
  },
  handler: async (ctx, args): Promise<Result<Doc<"memberKeys"> | null>> => {
    const userResult = await getAuthUser(ctx);
    if (isFailure(userResult)) return userResult;

    const membershipResult = await requireOrgMember(ctx, args.orgId);
    if (isFailure(membershipResult)) return membershipResult;

    const matches = await ctx.db
      .query("memberKeys")
      .withIndex("by_org_user_publicKey", (q) =>
        q
          .eq("orgId", args.orgId)
          .eq("userId", userResult.data._id)
          .eq("publicKey", args.publicKey),
      )
      .filter((q) => q.neq(q.field("status"), "revoked"))
      .take(2);

    if (matches.length > 1) {
      console.error(
        "Duplicate memberKeys detected for org/user/publicKey",
        args.orgId,
        userResult.data._id,
        args.publicKey,
      );
      return failure(
        HttpStatus.CONFLICT,
        "key:duplicate",
        "A duplicate key record exists; please contact support",
      );
    }

    return success(matches[0] ?? null);
  },
});

export const listPendingKeys = query({
  args: {
    orgId: v.id("organizations"),
  },
  handler: async (ctx, args): Promise<Result<Doc<"memberKeys">[]>> => {
    const authResult = await requireOrgAdmin(ctx, args.orgId);
    if (isFailure(authResult)) return authResult;

    const pendingKeys = await ctx.db
      .query("memberKeys")
      .withIndex("by_org_and_status", (q) =>
        q.eq("orgId", args.orgId).eq("status", "pending"),
      )
      .collect();

    return success(pendingKeys);
  },
});

export const getPublicKey = query({
  args: {
    keyId: v.id("memberKeys"),
  },
  handler: async (ctx, args): Promise<Result<{ publicKey: string }>> => {
    const memberKey = await ctx.db.get(args.keyId);
    if (!memberKey) {
      return failure(
        HttpStatus.NOT_FOUND,
        "key:not_found",
        "Key record not found",
      );
    }

    const authResult = await requireOrgMember(ctx, memberKey.orgId);
    if (isFailure(authResult)) return authResult;

    return success({ publicKey: memberKey.publicKey });
  },
});

export const listActiveKeys = query({
  args: {
    orgId: v.id("organizations"),
  },
  handler: async (ctx, args): Promise<Result<Doc<"memberKeys">[]>> => {
    const authResult = await requireOrgAdmin(ctx, args.orgId);
    if (isFailure(authResult)) return authResult;

    const activeKeys = await ctx.db
      .query("memberKeys")
      .withIndex("by_org_and_status", (q) =>
        q.eq("orgId", args.orgId).eq("status", "active"),
      )
      .collect();

    return success(activeKeys);
  },
});

export const listMemberKeys = query({
  args: {
    orgId: v.id("organizations"),
    userId: v.string(),
  },
  handler: async (
    ctx,
    args,
  ): Promise<
    Result<
      Pick<Doc<"memberKeys">, "_id" | "status" | "createdAt" | "updatedAt">[]
    >
  > => {
    const authResult = await requireOrgAdmin(ctx, args.orgId);
    if (isFailure(authResult)) return authResult;

    const keys = await ctx.db
      .query("memberKeys")
      .withIndex("by_org_and_user", (q) =>
        q.eq("orgId", args.orgId).eq("userId", args.userId),
      )
      .collect();

    return success(
      keys.map(({ _id, status, createdAt, updatedAt }) => ({
        _id,
        status,
        createdAt,
        updatedAt,
      })),
    );
  },
});

export const rotateOrgKey = mutation({
  args: {
    orgId: v.id("organizations"),
    wrappedKeys: v.array(
      v.object({
        keyId: v.id("memberKeys"),
        wrappedOrgKey: v.string(),
      }),
    ),
    reEncryptedSecrets: v.array(
      v.object({
        secretId: v.id("secrets"),
        encryptedValue: v.string(),
      }),
    ),
  },
  handler: async (
    ctx,
    args,
  ): Promise<Result<{ keysUpdated: number; secretsUpdated: number }>> => {
    const authResult = await requireOrgAdmin(ctx, args.orgId);
    if (isFailure(authResult)) return authResult;

    let keysUpdated = 0;
    for (const wk of args.wrappedKeys) {
      const key = await ctx.db.get(wk.keyId);
      if (!key || key.orgId !== args.orgId || key.status !== "active") continue;

      await ctx.db.patch(wk.keyId, {
        wrappedOrgKey: wk.wrappedOrgKey,
        updatedAt: Date.now(),
      });
      keysUpdated++;
    }

    let secretsUpdated = 0;
    for (const rs of args.reEncryptedSecrets) {
      const secret = await ctx.db.get(rs.secretId);
      if (!secret) continue;

      const env = await ctx.db.get(secret.environmentId);
      if (!env) continue;
      const project = await ctx.db.get(env.projectId);
      if (!project || project.orgId !== args.orgId) continue;

      await ctx.db.patch(rs.secretId, {
        encryptedValue: rs.encryptedValue,
        updatedAt: Date.now(),
      });
      secretsUpdated++;
    }

    return success({
      keysUpdated,
      secretsUpdated,
    });
  },
});

export const listMySessions = query({
  args: {
    orgId: v.id("organizations"),
  },
  handler: async (ctx, args): Promise<Result<Doc<"memberKeys">[]>> => {
    const userResult = await getAuthUser(ctx);
    if (isFailure(userResult)) return userResult;

    const membershipResult = await requireOrgMember(ctx, args.orgId);
    if (isFailure(membershipResult)) return membershipResult;

    const keys = await ctx.db
      .query("memberKeys")
      .withIndex("by_org_and_user", (q) =>
        q.eq("orgId", args.orgId).eq("userId", userResult.data._id),
      )
      .collect();

    return success(keys);
  },
});

export const approveMySession = mutation({
  args: {
    keyId: v.id("memberKeys"),
    wrappedOrgKey: v.string(),
  },
  handler: async (ctx, args): Promise<Result<Doc<"memberKeys">>> => {
    const userResult = await getAuthUser(ctx);
    if (isFailure(userResult)) return userResult;

    const memberKey = await ctx.db.get(args.keyId);
    if (!memberKey) {
      return failure(
        HttpStatus.NOT_FOUND,
        "key:not_found",
        "Key record not found",
      );
    }

    const membershipResult = await requireOrgMember(ctx, memberKey.orgId);
    if (isFailure(membershipResult)) return membershipResult;

    if (memberKey.userId !== userResult.data._id) {
      return failure(
        HttpStatus.FORBIDDEN,
        "key:not_owner",
        "You can only approve your own device sessions",
      );
    }

    if (memberKey.status !== "pending") {
      return failure(
        HttpStatus.BAD_REQUEST,
        "key:not_pending",
        "Only pending keys can be approved",
      );
    }

    await ctx.db.patch(args.keyId, {
      wrappedOrgKey: args.wrappedOrgKey,
      status: "active",
      updatedAt: Date.now(),
    });

    const updated = await ctx.db.get(args.keyId);
    if (!updated) {
      return failure(
        HttpStatus.INTERNAL_SERVER_ERROR,
        "key:approve_failed",
        "Failed to approve session",
      );
    }

    return success(updated);
  },
});

export const updateKeySessionToken = mutation({
  args: {
    keyId: v.id("memberKeys"),
    sessionToken: v.string(),
  },
  handler: async (ctx, args): Promise<Result<null>> => {
    const userResult = await getAuthUser(ctx);
    if (isFailure(userResult)) return userResult;

    const key = await ctx.db.get(args.keyId);
    if (!key) {
      return failure(
        HttpStatus.NOT_FOUND,
        "key:not_found",
        "Key record not found",
      );
    }

    const membershipResult = await requireOrgMember(ctx, key.orgId);
    if (isFailure(membershipResult)) return membershipResult;

    if (key.userId !== userResult.data._id) {
      return failure(
        HttpStatus.FORBIDDEN,
        "key:not_owner",
        "You can only update your own keys",
      );
    }

    if (key.sessionToken === args.sessionToken) {
      return success(null);
    }

    await ctx.db.patch(key._id, {
      sessionToken: args.sessionToken,
      updatedAt: Date.now(),
    });

    return success(null);
  },
});

async function validateMyKey(
  ctx: MutationCtx,
  userId: string,
  keyId: Doc<"memberKeys">["_id"],
): Promise<Result<Doc<"memberKeys">>> {
  const key = await ctx.db.get(keyId);
  if (!key) {
    return failure(
      HttpStatus.NOT_FOUND,
      "key:not_found",
      "Key record not found",
    );
  }

  const membershipResult = await requireOrgMember(ctx, key.orgId);
  if (isFailure(membershipResult)) return membershipResult;

  if (key.userId !== userId) {
    return failure(
      HttpStatus.FORBIDDEN,
      "key:not_owner",
      "You can only manage your own device keys",
    );
  }

  return success(key);
}

export const revokeMyKey = mutation({
  args: {
    keyId: v.id("memberKeys"),
  },
  handler: async (ctx, args): Promise<Result<null>> => {
    const userResult = await getAuthUser(ctx);
    if (isFailure(userResult)) return userResult;

    const keyResult = await validateMyKey(ctx, userResult.data._id, args.keyId);
    if (isFailure(keyResult)) return keyResult;

    await ctx.db.patch(args.keyId, {
      status: "revoked",
      wrappedOrgKey: undefined,
      updatedAt: Date.now(),
    });
    return success(null);
  },
});

export const revokeMyAuthSession = mutation({
  args: {
    sessionToken: v.string(),
  },
  handler: async (ctx, args): Promise<Result<null>> => {
    const userResult = await getAuthUser(ctx);
    if (isFailure(userResult)) return userResult;

    try {
      const { auth, headers } = await authComponent.getAuth(createAuth, ctx);

      await auth.api.revokeSession({
        body: { token: args.sessionToken },
        headers,
      });
    } catch (e) {
      console.error("Failed to revoke Better Auth session:", e);
      return failure(
        HttpStatus.INTERNAL_SERVER_ERROR,
        "session:revoke_failed",
        "Failed to revoke login session",
      );
    }

    return success(null);
  },
});

export const revokeMySessionAndKey = mutation({
  args: {
    keyId: v.id("memberKeys"),
  },
  handler: async (ctx, args): Promise<Result<null>> => {
    const userResult = await getAuthUser(ctx);
    if (isFailure(userResult)) return userResult;

    const keyResult = await validateMyKey(ctx, userResult.data._id, args.keyId);
    if (isFailure(keyResult)) return keyResult;

    const key = keyResult.data;

    try {
      const { auth, headers } = await authComponent.getAuth(createAuth, ctx);

      await auth.api.revokeSession({
        body: { token: key.sessionToken },
        headers,
      });
    } catch (e) {
      console.error("Failed to revoke Better Auth session:", e);
      return failure(
        HttpStatus.INTERNAL_SERVER_ERROR,
        "session:revoke_failed",
        "Failed to revoke login session",
      );
    }

    await ctx.db.patch(args.keyId, {
      status: "revoked",
      wrappedOrgKey: undefined,
      updatedAt: Date.now(),
    });
    return success(null);
  },
});
