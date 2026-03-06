import { api } from "@beakcrypt/convex";
import { query, mutation } from "../../lib/convex-client";
import { resolveContext } from "../../lib/context";
import { unwrapResult, CliError } from "../../lib/errors";
import * as interactive from "../../lib/interactive";
import * as output from "../../lib/output";

export async function envRemoveCommand(
  name: string,
  opts: { org?: string; project?: string; yes?: boolean },
): Promise<void> {
  const ctx = await resolveContext({ ...opts, env: "development" });

  // Find the environment by name
  const envsResult = await query(api.environments.list, {
    projectId: ctx.projectId as never,
  });
  const envs = unwrapResult(envsResult);
  const env = envs.find(
    (e: { name: string }) => e.name.toLowerCase() === name.toLowerCase(),
  );

  if (!env) {
    throw new CliError(`Environment "${name}" not found.`);
  }

  if ((env as { isPersonal?: boolean }).isPersonal) {
    throw new CliError("Personal environments cannot be removed via the CLI.");
  }

  if (!opts.yes) {
    const confirmed = await interactive.confirm(
      `Delete environment "${name}" and all its secrets in ${ctx.orgSlug}/${ctx.projectName}?`,
      false,
    );
    if (!confirmed) {
      output.info("Aborted.");
      return;
    }
  }

  const result = await mutation(api.environments.remove, {
    id: (env as { _id: string })._id as never,
  });
  unwrapResult(result);

  output.success(
    `Removed environment "${name}" from ${ctx.orgSlug}/${ctx.projectName}`,
  );
}
