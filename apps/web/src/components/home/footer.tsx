import { env } from "~/env";
import Link from "next/link";

const footerLinks = [
  {
    title: "Product",
    links: [
      { label: "About", href: "#" },
      { label: "Features", href: "#features" },
      { label: "How it Works", href: "#how-it-works" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "CLI Guide", href: `${env.SITE_URL}/docs/cli` },
      { label: "Changelog", href: "/changelog" },
      { label: "Documentation", href: `${env.SITE_URL}/docs` },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy Policy", href: "/privacy" },
      { label: "Terms of Service", href: "/terms" },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="border-t border-white/5 py-12">
      <div className="mx-auto max-w-6xl px-6">
        <div className="flex flex-col md:flex-row gap-12 justify-between">
          <div>
            <div className="mb-4 flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center border border-[#5eead4]/40">
                <div className="h-1.5 w-1.5 rotate-45 bg-[#5eead4]" />
              </div>
              <span className="text-sm font-medium">beakcrypt</span>
            </div>
            <p className="text-sm text-white/40">
              Secure env management for modern teams.
            </p>
            <span className="text-xs text-white/30">
              © 2026 BeakCrypt. All Rights Reserved.
            </span>
          </div>

          <div className="flex flex-col md:flex-row gap-8 lg:gap-20 w-fit">
            {footerLinks.map((col) => (
              <div key={col.title} className="w-32">
                <div className="mb-3 text-xs font-medium uppercase tracking-wider">
                  {col.title}
                </div>
                <div className="flex flex-col gap-2">
                  {col.links.map((link) => (
                    <Link
                      key={link.label}
                      href={link.href}
                      className="text-sm text-white/50 transition-colors hover:text-white"
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
