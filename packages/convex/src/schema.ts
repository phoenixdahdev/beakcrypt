import { v } from "convex/values";
import { defineSchema, defineTable } from "convex/server";

export const roles = v.union(
  v.literal("owner"),
  v.literal("admin"),
  v.literal("member"),
);

export default defineSchema({
  waitlists: defineTable({
    email: v.string(),
    updatedAt: v.number(),
    createdAt: v.optional(v.number()),
  }).index("by_email", ["email"]),

  organizations: defineTable({
    name: v.string(),
    slug: v.string(),
    ownerId: v.string(),
    avatar: v.optional(v.string()),
    createdAt: v.optional(v.number()),
    updatedAt: v.number(),
  })
    .index("by_slug", ["slug"])
    .index("by_owner", ["ownerId"]),

  organizationMembers: defineTable({
    orgId: v.id("organizations"),
    userId: v.string(),
    role: roles,
    createdAt: v.optional(v.number()),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
  })
    .index("by_org", ["orgId"])
    .index("by_user", ["userId"])
    .index("by_org_and_user", ["orgId", "userId"]),

  invites: defineTable({
    orgId: v.id("organizations"),
    email: v.string(),
    role: roles,
    token: v.string(),
    inviterId: v.string(),
    expiresAt: v.number(),
    status: v.union(
      v.literal("pending"),
      v.literal("accepted"),
      v.literal("expired"),
      v.literal("revoked"),
      v.literal("declined"),
    ),
    createdAt: v.optional(v.number()),
    updatedAt: v.number(),
  })
    .index("by_org", ["orgId"])
    .index("by_token", ["token"])
    .index("by_email", ["email"])
    .index("by_org_and_status", ["orgId", "status"]),

  projects: defineTable({
    name: v.string(),
    createdBy: v.string(),
    updatedAt: v.number(),
    orgId: v.id("organizations"),
    createdAt: v.optional(v.number()),
    deletedAt: v.optional(v.number()),
    githubRepoId: v.optional(v.number()),
    githubRepoUrl: v.optional(v.string()),
    githubRepoName: v.optional(v.string()),
  })
    .index("by_name", ["name"])
    .index("by_org", ["orgId"])
    .index("by_github_repo", ["githubRepoId"])
    .index("by_org_and_name", ["orgId", "name"]),

  environments: defineTable({
    name: v.string(),
    order: v.number(),
    updatedAt: v.number(),
    projectId: v.id("projects"),
    createdAt: v.optional(v.number()),
    deletedAt: v.optional(v.number()),
    isPersonal: v.optional(v.boolean()),
    ownerId: v.optional(v.string()),
  })
    .index("by_name", ["name"])
    .index("by_project", ["projectId"])
    .index("by_project_and_name", ["projectId", "name"])
    .index("by_project_and_owner", ["projectId", "ownerId"]),

  secrets: defineTable({
    key: v.string(),
    createdBy: v.string(),
    updatedAt: v.number(),
    encryptedValue: v.string(),
    createdAt: v.optional(v.number()),
    deletedAt: v.optional(v.number()),
    environmentId: v.id("environments"),
  })
    .index("by_key", ["key"])
    .index("by_environment", ["environmentId"])
    .index("by_env_and_key", ["environmentId", "key"]),

  memberKeys: defineTable({
    orgId: v.id("organizations"),
    userId: v.string(),
    publicKey: v.string(),
    wrappedOrgKey: v.optional(v.string()),
    sessionToken: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("active"),
      v.literal("revoked"),
    ),
    createdAt: v.optional(v.number()),
    updatedAt: v.number(),
  })
    .index("by_org", ["orgId"])
    .index("by_user", ["userId"])
    .index("by_org_and_user", ["orgId", "userId"])
    .index("by_org_and_status", ["orgId", "status"])
    .index("by_org_user_publicKey", ["orgId", "userId", "publicKey"]),
});
