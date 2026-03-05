import { z } from "zod/v4";
import { createEnv } from "@t3-oss/env-nextjs";

export const env = createEnv({
  server: {
    NODE_ENV: z
      .enum(["local", "test", "development", "staging", "production"])
      .default("development"),
    SITE_URL: z.url(),
    CONVEX_URL: z.url(),
    CONVEX_SITE_URL: z.url(),
    GITHUB_CLIENT_ID: z.string(),
    CONVEX_DEPLOYMENT: z.string(),
    BETTER_AUTH_SECRET: z.string(),
    GITHUB_CLIENT_SECRET: z.string(),
  },
  client: {
    NEXT_PUBLIC_SITE_URL: z.url(),
    NEXT_PUBLIC_CONVEX_URL: z.url(),
    NEXT_PUBLIC_CONVEX_SITE_URL: z.url(),
  },
  emptyStringAsUndefined: true,
  experimental__runtimeEnv: {
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_CONVEX_URL: process.env.NEXT_PUBLIC_CONVEX_URL,
    NEXT_PUBLIC_CONVEX_SITE_URL: process.env.NEXT_PUBLIC_CONVEX_SITE_URL,
  },
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
});
