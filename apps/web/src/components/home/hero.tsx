import { env } from "~/env";
import Link from "next/link";
import AnimatedTerminal from "./animated-terminal";
import AnimatedPlatform from "./animated-platform";
import { Button } from "@beakcrypt/ui/components/button";

export default function Hero() {
  return (
    <section className="pt-36 pb-20 md:pt-40 md:pb-28">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <h1 className="mb-5 font-serif text-4xl font-medium leading-tight tracking-normal md:text-5xl">
              Stop sending <span className="text-[#5eead4]">.env</span> files
              over <AnimatedPlatform />
            </h1>

            <p className="mb-8 max-w-md text-lg leading-relaxed text-white/60">
              Encrypted environment variables that sync across your entire team.
              One command. Zero plaintext exposure.
            </p>

            <div className="mb-8 flex flex-wrap items-center gap-4">
              <Link href="/auth">
                <Button size="sm" variant="secondary">
                  Start for Free
                </Button>
              </Link>
              <Button variant="outline">
                <a
                  href={`${env.SITE_URL}/docs`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Read the Docs
                </a>
              </Button>
            </div>
          </div>

          <AnimatedTerminal />
        </div>
      </div>
    </section>
  );
}
