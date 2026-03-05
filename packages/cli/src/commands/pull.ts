import { resolve } from "node:path";
import ora from "ora";
import { api } from "@beakcrypt/convex";
import { decryptSecret } from "@beakcrypt/crypto";
import { query } from "../lib/convex-client";
import { resolveContext } from "../lib/context";
import { ensureOrgKey } from "../lib/key-manager";
import { writeEnvFile } from "../lib/env-file";
import { unwrapResult } from "../lib/errors";
import * as output from "../lib/output";

export async function pullCommand(
  file: string | undefined,
  opts: { org?: string; project?: string; env?: string; output?: string },
): Promise<void> {
  // --output flag takes precedence over the positional argument; both default to .env.local
  const target = opts.output ?? file ?? ".env.local";
  const filePath = resolve(target);
  const ctx = await resolveContext(opts);

  const spinner = ora("Pulling secrets...").start();

  const orgKey = await ensureOrgKey(ctx.orgId);

  const secretsResult = await query(api.secrets.list, {
    environmentId: ctx.environmentId as never,
  });
  const secrets = unwrapResult(secretsResult);

  const decrypted: Record<string, string> = {};
  for (const secret of secrets) {
    decrypted[secret.key] = await decryptSecret(secret.encryptedValue, orgKey);
  }

  await writeEnvFile(filePath, decrypted);
  spinner.stop();

  output.success(
    `Pulled ${secrets.length} secret${secrets.length === 1 ? "" : "s"} to ${filePath}`,
  );
}
