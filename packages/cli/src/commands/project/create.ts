import { api } from "@beakcrypt/convex";
import { query, mutation } from "../../lib/convex-client";
import { ensureAuth } from "../../lib/context";
import { getProjectConfig } from "../../lib/project-config";
import { unwrapResult, CliError } from "../../lib/errors";
import * as output from "../../lib/output";

export async function projectCreateCommand(
  name: string,
  opts: { org?: string },
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

  const result = await mutation(api.projects.create, {
    name: name.trim(),
    orgId: org._id as never,
  });
  const project = unwrapResult(result);

  output.success(`Created project "${project.name}" in ${orgSlug}`);
  output.info(
    `Default environments (development, staging, production) have been created.`,
  );
}
