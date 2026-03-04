import { z } from "zod/v4";
import { createEnv } from "@t3-oss/env-nextjs";

export const env = createEnv({
  server: {
    NODE_ENV: z
      .enum(["local", "test", "development", "staging", "production"])
      .default("development"),
    SITE_URL: z.url(),
  },
  client: {
    NEXT_PUBLIC_SITE_URL: z.url(),
  },
  emptyStringAsUndefined: true,
  experimental__runtimeEnv: {
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  },
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
});
