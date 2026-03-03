"use client";

import { Check, Copy } from "lucide-react";
import { useCopyToClipboard } from "~/hooks/use-copy-to-clipboard";

const Step = ({
  item,
}: {
  item: { step: string; title: string; desc: string; code: string };
}) => {
  const { copied, copy } = useCopyToClipboard({ timeout: 1000 });
  return (
    <div key={item.step}>
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded border border-[#5eead4]/50 text-sm font-medium text-[#5eead4]">
          {item.step}
        </div>
        <div className="h-px flex-1 bg-white/10" />
      </div>
      <h3 className="mb-2 font-medium">{item.title}</h3>
      <p className="mb-4 text-sm text-white/50">{item.desc}</p>
      <div className="rounded border border-white/5 bg-[#09090b] px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-x-2 font-mono text-sm text-white/60">
          <span className="text-[#5eead4]">$</span>
          <p>{item.code}</p>
        </div>
        <button
          type="button"
          onClick={() => copy(item.code)}
          aria-label={copied ? "Copied command" : "Copy command"}
          title={copied ? "Copied" : "Copy command"}
          className="flex h-8 w-8 items-center justify-center rounded border border-white/5 transition-all hover:border-[#5eead4]/50 text-sm cursor-pointer"
        >
          {copied ? (
            <Check aria-hidden="true" color="#5eead4" />
          ) : (
            <Copy aria-hidden="true" color="#5eead4" />
          )}
        </button>
      </div>
    </div>
  );
};

export default Step;
