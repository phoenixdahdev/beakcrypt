import { api } from "@beakcrypt/convex";
import { query } from "../../lib/convex-client";
import { ensureAuth } from "../../lib/context";
import { getProjectConfig } from "../../lib/project-config";
import { unwrapResult, CliError } from "../../lib/errors";
import * as output from "../../lib/output";

export async function projectListCommand(opts: {
  org?: string;
}): Promise<void> {
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

  const result = await query(api.projects.list, {
    orgId: org._id as never,
  });
  const projects = unwrapResult(result);

  if (projects.length === 0) {
    output.info(`No projects in ${orgSlug}.`);
    return;
  }

  console.log(`\n${output.bold(orgSlug)} projects:\n`);
  output.table(
    projects.map((p: { name: string }) => [p.name]),
    ["Name"],
  );
  console.log();
}
