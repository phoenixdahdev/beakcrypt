"use node";

import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";

type VercelEnvVarResponse = {
  id: string;
  key: string;
  value: string;
  target: string[];
  type: string;
};

type SyncResult = {
  hookId: string;
  provider: "vercel";
  upserted: number;
  redeployTriggered: boolean;
  error?: string;
};

export const syncToVercel = internalAction({
  args: {
    hookId: v.id("deploymentHooks"),
    decryptedSecrets: v.array(v.object({ key: v.string(), value: v.string() })),
  },
  handler: async (ctx, args): Promise<SyncResult> => {
    const hook = await ctx.runQuery(internal.deploymentHooks.getHookById, {
      id: args.hookId,
    });

    if (!hook) {
      return {
        hookId: args.hookId,
        provider: "vercel",
        upserted: 0,
        redeployTriggered: false,
        error: "Deployment hook not found",
      };
    }

    const {
      vercelApiToken,
      providerProjectId,
      providerTeamId,
      targetEnvironment,
      triggerRedeploy,
    } = hook;

    const teamParam = providerTeamId ? `teamId=${providerTeamId}` : "";
    const qs = (extraParam?: string) => {
      const parts = [teamParam, extraParam].filter(Boolean).join("&");
      return parts ? `?${parts}` : "";
    };

    const baseUrl = "https://api.vercel.com";
    const headers = {
      Authorization: `Bearer ${vercelApiToken}`,
      "Content-Type": "application/json",
    };

    // Fetch existing env vars for the project
    let existingEnvVars: VercelEnvVarResponse[] = [];
    try {
      const listUrl = `${baseUrl}/v9/projects/${encodeURIComponent(providerProjectId)}/env${qs()}`;
      const listRes = await fetch(listUrl, { headers });
      if (listRes.ok) {
        const data = (await listRes.json()) as {
          envs?: VercelEnvVarResponse[];
        };
        existingEnvVars = data.envs ?? [];
      }
    } catch {
      // proceed without existing vars — will create all
    }

    const existingByKey = new Map<string, VercelEnvVarResponse>();
    for (const ev of existingEnvVars) {
      if (ev.target.includes(targetEnvironment)) {
        existingByKey.set(ev.key, ev);
      }
    }

    let upserted = 0;

    for (const secret of args.decryptedSecrets) {
      const existing = existingByKey.get(secret.key);

      if (existing) {
        const patchUrl = `${baseUrl}/v9/projects/${encodeURIComponent(providerProjectId)}/env/${existing.id}${qs()}`;
        const patchRes = await fetch(patchUrl, {
          method: "PATCH",
          headers,
          body: JSON.stringify({
            value: secret.value,
            target: [targetEnvironment],
            type: "encrypted",
          }),
        });
        if (patchRes.ok) upserted++;
      } else {
        const createUrl = `${baseUrl}/v10/projects/${encodeURIComponent(providerProjectId)}/env${qs()}`;
        const createRes = await fetch(createUrl, {
          method: "POST",
          headers,
          body: JSON.stringify({
            key: secret.key,
            value: secret.value,
            target: [targetEnvironment],
            type: "encrypted",
          }),
        });
        if (createRes.ok) upserted++;
      }
    }

    let redeployTriggered = false;

    if (triggerRedeploy) {
      try {
        const deployUrl = `${baseUrl}/v13/deployments${qs()}`;
        const deployRes = await fetch(deployUrl, {
          method: "POST",
          headers,
          body: JSON.stringify({
            name: providerProjectId,
            target: targetEnvironment,
          }),
        });
        redeployTriggered = deployRes.ok;
      } catch {
        // non-fatal
      }
    }

    return {
      hookId: args.hookId,
      provider: "vercel",
      upserted,
      redeployTriggered,
    };
  },
});
