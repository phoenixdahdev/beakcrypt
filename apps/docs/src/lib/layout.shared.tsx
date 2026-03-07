import { env } from "~/env";
import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

export const gitConfig = {
  user: "prudentbird",
  repo: "beakcrypt",
  branch: "dev",
};

function BeakcryptLogo() {
  return (
    <span className="flex items-center gap-2">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="22"
        height="22"
        viewBox="0 0 72 72"
        fill="none"
        aria-hidden="true"
      >
        <rect
          x="8"
          y="8"
          width="56"
          height="56"
          rx="4"
          stroke="#5eead4"
          strokeOpacity="0.5"
          strokeWidth="3"
          fill="#0a0a0a"
        />
        <rect
          x="28"
          y="28"
          width="16"
          height="16"
          rx="1"
          transform="rotate(45 36 36)"
          fill="#5eead4"
        />
      </svg>
      <span className="font-semibold text-base tracking-tight">Beakcrypt</span>
    </span>
  );
}

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      url: env.SITE_URL,
      title: <BeakcryptLogo />,
    },
    githubUrl: `https://github.com/${gitConfig.user}/${gitConfig.repo}`,
  };
}
