import { api } from "@beakcrypt/convex";
import { query, mutation } from "../../lib/convex-client";
import { ensureAuth } from "../../lib/context";
import { getProjectConfig } from "../../lib/project-config";
import { unwrapResult, CliError } from "../../lib/errors";
import * as interactive from "../../lib/interactive";
import * as output from "../../lib/output";

export async function projectRemoveCommand(
  name: string,
  opts: { org?: string; yes?: boolean },
): Promise<void> {
  await ensureAuth();

  let orgSlug = opts.org;
  if (!orgSlug) {
    const config = await getProjectConfig();
    orgSlug = config?.orgSlug;
  }

  if (!orgSlug) {
    throw new CliError(
      "Organization slug is required.",
      "Use --org <slug> or run `beakcrypt org list` to see your organizations.",
    );
  }

  const orgResult = await query(api.organizations.getBySlug, {
    slug: orgSlug,
  });
  const org = unwrapResult(orgResult);

  const projectResult = await query(api.projects.getByName, {
    orgId: org._id as never,
    name,
  });
  const project = unwrapResult(projectResult);

  if (!opts.yes) {
    const confirmed = await interactive.confirm(
      `Delete project "${name}" and all its environments and secrets in ${orgSlug}?`,
      false,
    );
    if (!confirmed) {
      output.info("Aborted.");
      return;
    }
  }

  const result = await mutation(api.projects.remove, {
    id: project._id as never,
  });
  unwrapResult(result);

  output.success(`Removed project "${name}" from ${orgSlug}`);
}
