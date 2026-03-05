import { api } from "@beakcrypt/convex";
import { query } from "../../lib/convex-client";
import { ensureAuth } from "../../lib/context";
import { unwrapResult, CliError } from "../../lib/errors";
import * as output from "../../lib/output";

export async function projectListCommand(opts: {
  org?: string;
}): Promise<void> {
  await ensureAuth();

  if (!opts.org) {
    throw new CliError(
      "Organization slug is required.",
      "Use --org <slug> or run `beakcrypt link` to set a default.",
    );
  }

  const orgResult = await query(api.organizations.getBySlug, {
    slug: opts.org,
  });
  const org = unwrapResult(orgResult);

  const result = await query(api.projects.list, {
    orgId: org._id as never,
  });
  const projects = unwrapResult(result);

  if (projects.length === 0) {
    output.info(`No projects in ${opts.org}.`);
    return;
  }

  console.log(`\n${output.bold(opts.org)} projects:\n`);
  output.table(
    projects.map((p: { name: string }) => [p.name]),
    ["Name"],
  );
  console.log();
}
