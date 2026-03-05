import { api } from "@beakcrypt/convex";
import { mutation } from "../../lib/convex-client";
import { resolveContext } from "../../lib/context";
import { unwrapResult } from "../../lib/errors";
import * as output from "../../lib/output";

export async function envCreateCommand(
  name: string,
  opts: { org?: string; project?: string },
): Promise<void> {
  // Resolve org/project without needing a specific env
  const ctx = await resolveContext({ ...opts, env: "development" });

  const result = await mutation(api.environments.create, {
    name: name.trim().toLowerCase(),
    projectId: ctx.projectId as never,
  });
  const env = unwrapResult(result);

  output.success(
    `Created environment "${env.name}" in ${ctx.orgSlug}/${ctx.projectName}`,
  );
}
