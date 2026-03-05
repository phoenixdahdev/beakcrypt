import { api } from "@beakcrypt/convex";
import { query, mutation } from "../../lib/convex-client";
import { ensureAuth } from "../../lib/context";
import { unwrapResult, CliError } from "../../lib/errors";
import * as output from "../../lib/output";

export async function projectCreateCommand(
  name: string,
  opts: { org?: string },
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

  const result = await mutation(api.projects.create, {
    name: name.trim(),
    orgId: org._id as never,
  });
  const project = unwrapResult(result);

  output.success(`Created project "${project.name}" in ${opts.org}`);
  output.info(
    `Default environments (development, staging, production) have been created.`,
  );
}
