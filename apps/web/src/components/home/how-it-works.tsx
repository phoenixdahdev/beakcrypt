import Step from "./step";

const steps: { step: string; title: string; desc: string; code: string }[] = [
  {
    step: "1",
    title: "Connect your project",
    desc: "Link your repository. We detect your project and create a secure vault.",
    code: "npx beakcrypt init",
  },
  {
    step: "2",
    title: "Add your variables",
    desc: "Import from .env or add via dashboard. Encrypted client-side.",
    code: "npx beakcrypt push .env",
  },
  {
    step: "3",
    title: "Sync your team",
    desc: "Invite members. One command gets everyone the latest secrets.",
    code: "npx beakcrypt pull",
  },
];

export default function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="border-y border-white/5 bg-white/1 py-24"
    >
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-12 text-center">
          <div className="mb-4 flex items-center justify-center gap-3">
            <div className="h-px w-8 bg-[#5eead4]" />
            <span className="text-xs font-medium uppercase tracking-wider text-[#5eead4]">
              How it works
            </span>
            <div className="h-px w-8 bg-[#5eead4]" />
          </div>
          <h2 className="mb-4 font-serif text-3xl font-medium tracking-tight md:text-4xl">
            Get started in 3 minutes
          </h2>
        </div>

        <div className="grid gap-8 md:grid-cols-3">
          {steps.map((item) => (
            <Step key={item.step} item={item} />
          ))}
        </div>
      </div>
    </section>
  );
}
