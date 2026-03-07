import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@beakcrypt/ui/components/skeleton";
import { Separator } from "@beakcrypt/ui/components/separator";
import { SidebarTrigger } from "@beakcrypt/ui/components/sidebar";
import HooksHandler from "./handler";

export const metadata: Metadata = {
  title: "Deployment Hooks - Beakcrypt",
  description: "Manage deployment hooks for your project.",
};

function HooksSkeleton() {
  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center gap-3 px-6 py-4">
        <SidebarTrigger className="-ml-1" />
        <div>
          <Skeleton className="h-5 w-40" />
          <Skeleton className="mt-1 h-4 w-56" />
        </div>
      </div>
      <Separator />
      <div className="flex flex-col gap-6 p-6 max-w-2xl">
        <div className="space-y-3 rounded-lg border p-4">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-9 w-full rounded-md" />
          <Skeleton className="h-9 w-full rounded-md" />
          <Skeleton className="h-9 w-full rounded-md" />
        </div>
      </div>
    </div>
  );
}

export default function HooksPage({
  params,
}: {
  params: Promise<{ slug: string; project: string }>;
}) {
  return (
    <Suspense fallback={<HooksSkeleton />}>
      <HooksHandler paramsPromise={params} />
    </Suspense>
  );
}
