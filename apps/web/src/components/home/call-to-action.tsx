import { env } from "~/env";
import Link from "next/link";
import { Button } from "@beakcrypt/ui/components/button";

export default function CallToAction() {
  return (
    <section className="px-6 py-24">
      <div className="mx-auto max-w-3xl">
        <div className="relative rounded-lg border border-white/10 bg-white/2 p-10 text-center md:p-14">
          <div className="absolute left-4 top-4 h-4 w-4 border-l border-t border-[#5eead4]/30" />
          <div className="absolute right-4 top-4 h-4 w-4 border-r border-t border-[#5eead4]/30" />
          <div className="absolute bottom-4 left-4 h-4 w-4 border-b border-l border-[#5eead4]/30" />
          <div className="absolute bottom-4 right-4 h-4 w-4 border-b border-r border-[#5eead4]/30" />

          <h2 className="mb-4 font-serif text-3xl font-medium tracking-tight md:text-4xl">
            Ready to secure your secrets?
          </h2>
          <p className="mx-auto mb-8 max-w-md text-white/50">
            Free for personal use. Read the docs for more information.
          </p>

          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/auth">
              <Button className="h-11 bg-[#5eead4] px-7 text-sm font-medium text-[#09090b] hover:bg-[#5eead4]/90">
                Start for Free
              </Button>
            </Link>
            <Button
              variant="outline"
              className="h-11 border-white/10 bg-transparent px-7 text-sm text-white/70 hover:bg-white/5"
              asChild
            >
              <a href={`${env.SITE_URL}/docs`}>Read the Docs</a>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
