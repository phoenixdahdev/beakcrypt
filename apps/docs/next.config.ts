/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.ts";
import type { NextConfig } from "next";
import { createMDX } from "fumadocs-mdx/next";
import { withMicrofrontends } from "@vercel/microfrontends/next/config";

const withMDX = createMDX();

const nextConfig: NextConfig = {
  basePath: "/docs",
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: "/:path*.mdx",
        destination: "/llms.mdx/docs/:path*",
      },
    ];
  },
};

export default withMicrofrontends(withMDX(nextConfig));
