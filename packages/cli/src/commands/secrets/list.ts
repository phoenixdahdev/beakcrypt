import { api } from "@beakcrypt/convex";
import { query } from "../../lib/convex-client";
import { resolveContext } from "../../lib/context";
import { unwrapResult } from "../../lib/errors";
import { ensureOrgKey } from "../../lib/key-manager";
import { decryptSecret } from "@beakcrypt/crypto";
import * as output from "../../lib/output";

export async function secretsListCommand(opts: {
  org?: string;
  project?: string;
  env?: string;
  reveal?: boolean;
}): Promise<void> {
  const ctx = await resolveContext(opts);

  const result = await query(api.secrets.list, {
    environmentId: ctx.environmentId as never,
  });
  const secrets = unwrapResult(result);

  if (secrets.length === 0) {
    output.info(
      `No secrets in ${ctx.orgSlug}/${ctx.projectName} (${ctx.envName})`,
    );
    return;
  }

  console.log(
    `\n${output.bold(`${ctx.orgSlug}/${ctx.projectName}`)} ${output.dim(`(${ctx.envName})`)}\n`,
  );

  if (opts.reveal) {
    const orgKey = await ensureOrgKey(ctx.orgId);
    const rows = await Promise.all(
      secrets.map(async (s: { key: string; encryptedValue: string }) => {
        try {
          const value = await decryptSecret(s.encryptedValue, orgKey);
          return [s.key, value];
        } catch {
          return [s.key, output.dim("<decrypt error>")];
        }
      }),
    );
    output.table(rows, ["Key", "Value"]);
  } else {
    output.table(
      secrets.map((s: { key: string }) => [s.key, output.dim("••••••••")]),
      ["Key", "Value"],
    );
  }

  console.log(
    `\n${output.dim(`${secrets.length} secret${secrets.length === 1 ? "" : "s"}`)}\n`,
  );
}
