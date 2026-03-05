import { api } from "@beakcrypt/convex";
import { query, mutation } from "../../lib/convex-client";
import { ensureAuth } from "../../lib/context";
import { unwrapResult, CliError } from "../../lib/errors";
import * as interactive from "../../lib/interactive";
import * as output from "../../lib/output";

export async function projectRemoveCommand(
  name: string,
  opts: { org?: string; yes?: boolean },
): Promise<void> {
  await ensureAuth();

  if (!opts.org) {
    throw new CliError(
      "Organization slug is required.",
      "Use --org <slug> to specify the organization.",
    );
  }

  const orgResult = await query(api.organizations.getBySlug, {
    slug: opts.org,
  });
  const org = unwrapResult(orgResult);

  const projectResult = await query(api.projects.getByName, {
    orgId: org._id as never,
    name,
  });
  const project = unwrapResult(projectResult);

  if (!opts.yes) {
    const confirmed = await interactive.confirm(
      `Delete project "${name}" and all its environments and secrets in ${opts.org}?`,
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

  output.success(`Removed project "${name}" from ${opts.org}`);
}
