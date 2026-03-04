import { env } from "~/env";
import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

// fill this with your actual GitHub info, for example:
export const gitConfig = {
  user: "prudentbird",
  repo: "beakcrypt",
  branch: "dev",
};

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      url: env.SITE_URL,
      title: "Beakcrypt",
    },
    githubUrl: `https://github.com/${gitConfig.user}/${gitConfig.repo}`,
  };
}
