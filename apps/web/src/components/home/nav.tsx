import { env } from "~/env";
import Link from "next/link";
import { Button } from "@beakcrypt/ui/components/button";

export default function Nav() {
  return (
    <nav className="fixed z-10 top-0 w-full border-b border-white/5 bg-background">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center border border-[#5eead4]/50">
            <div className="h-2 w-2 rotate-45 bg-[#5eead4]" />
          </div>
          <span className="text-sm font-medium tracking-tight">beakcrypt</span>
        </Link>

        <div className="hidden items-center gap-6 md:flex">
          <Button variant="link" size="sm" asChild>
            <Link href="#features">Features</Link>
          </Button>
          <Button variant="link" size="sm" asChild>
            <Link href="#how-it-works">How it Works</Link>
          </Button>
          <Button variant="link" size="sm" asChild>
            <a href={`${env.SITE_URL}/docs`} target="_blank" rel="noreferrer">
              Docs
            </a>
          </Button>
        </div>

        <Link href="/auth">
          <Button size="sm" variant="secondary">
            Start for Free
          </Button>
        </Link>
      </div>
    </nav>
  );
}
