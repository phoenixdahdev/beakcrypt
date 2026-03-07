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

type VercelDeployment = {
  uid: string;
  name: string;
  target: string | null;
};

type SyncResult = {
  hookId: string;
  provider: "vercel";
  upserted: number;
  redeployTriggered: boolean;
  error?: string;
  redeployError?: string;
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
    const qs = (...extra: string[]) => {
      const parts = [teamParam, ...extra].filter(Boolean).join("&");
      return parts ? `?${parts}` : "";
    };

    const baseUrl = "https://api.vercel.com";
    const headers = {
      Authorization: `Bearer ${vercelApiToken}`,
      "Content-Type": "application/json",
    };

    // Fetch existing env vars for the project
    let existingEnvVars: VercelEnvVarResponse[] = [];
    let listError: string | undefined;
    try {
      const listUrl = `${baseUrl}/v9/projects/${encodeURIComponent(providerProjectId)}/env${qs()}`;
      const listRes = await fetch(listUrl, { headers });
      if (listRes.ok) {
        const data = (await listRes.json()) as {
          envs?: VercelEnvVarResponse[];
        };
        existingEnvVars = data.envs ?? [];
      } else {
        const errText = await listRes.text();
        listError = `Failed to list existing env vars (${listRes.status}): ${errText}`;
        console.error("[syncToVercel] list env vars failed:", listError);
      }
    } catch (err) {
      listError = `Failed to list existing env vars: ${String(err)}`;
      console.error("[syncToVercel] list env vars exception:", listError);
    }

    const existingByKey = new Map<string, VercelEnvVarResponse>();
    for (const ev of existingEnvVars) {
      if (ev.target.includes(targetEnvironment)) {
        existingByKey.set(ev.key, ev);
      }
    }

    let upserted = 0;

    // Separate secrets into creates and updates
    const toCreate: typeof args.decryptedSecrets = [];
    const toUpdate: Array<{
      id: string;
      key: string;
      value: string;
    }> = [];

    for (const secret of args.decryptedSecrets) {
      const existing = existingByKey.get(secret.key);
      if (existing) {
        toUpdate.push({
          id: existing.id,
          key: secret.key,
          value: secret.value,
        });
      } else {
        toCreate.push(secret);
      }
    }

    // Batch create new secrets (Vercel supports array POST for v10)
    if (toCreate.length > 0) {
      try {
        const createUrl = `${baseUrl}/v10/projects/${encodeURIComponent(providerProjectId)}/env${qs()}`;
        const body = toCreate.map((s) => ({
          key: s.key,
          value: s.value,
          target: [targetEnvironment],
          type: "encrypted",
        }));
        const createRes = await fetch(createUrl, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
        });
        if (createRes.ok) {
          upserted += toCreate.length;
        } else {
          const errText = await createRes.text();
          console.error(
            "[syncToVercel] batch create failed:",
            createRes.status,
            errText,
          );
        }
      } catch (err) {
        console.error("[syncToVercel] batch create exception:", String(err));
      }
    }

    // Update existing secrets one-by-one (PATCH does not support batching)
    for (const { id, value } of toUpdate) {
      try {
        const patchUrl = `${baseUrl}/v9/projects/${encodeURIComponent(providerProjectId)}/env/${id}${qs()}`;
        const patchRes = await fetch(patchUrl, {
          method: "PATCH",
          headers,
          body: JSON.stringify({
            value,
            target: [targetEnvironment],
            type: "encrypted",
          }),
        });
        if (patchRes.ok) {
          upserted++;
        } else {
          const errText = await patchRes.text();
          console.error(
            "[syncToVercel] patch env var failed:",
            patchRes.status,
            errText,
          );
        }
      } catch (err) {
        console.error("[syncToVercel] patch env var exception:", String(err));
      }
    }

    let redeployTriggered = false;
    let redeployError: string | undefined;

    if (triggerRedeploy) {
      try {
        // Fetch the latest deployment for the target environment to get its ID
        const listDeployUrl = `${baseUrl}/v6/deployments${qs(`projectId=${encodeURIComponent(providerProjectId)}`, `target=${targetEnvironment}`, "limit=1", "state=READY")}`;
        const listDeployRes = await fetch(listDeployUrl, { headers });

        if (listDeployRes.ok) {
          const listDeployData = (await listDeployRes.json()) as {
            deployments: VercelDeployment[];
          };
          const latestDeployment = listDeployData.deployments?.[0];

          if (latestDeployment?.uid) {
            const redeployUrl = `${baseUrl}/v13/deployments${qs()}`;
            const redeployRes = await fetch(redeployUrl, {
              method: "POST",
              headers,
              body: JSON.stringify({
                deploymentId: latestDeployment.uid,
                name: latestDeployment.name,
                target: targetEnvironment,
              }),
            });
            if (redeployRes.ok) {
              redeployTriggered = true;
            } else {
              const errText = await redeployRes.text();
              redeployError = `Redeploy failed (${redeployRes.status}): ${errText}`;
              console.error("[syncToVercel] redeploy failed:", redeployError);
            }
          } else {
            redeployError = `No existing deployment found for target "${targetEnvironment}"`;
            console.warn("[syncToVercel]", redeployError);
          }
        } else {
          const errText = await listDeployRes.text();
          redeployError = `Failed to list deployments (${listDeployRes.status}): ${errText}`;
          console.error(
            "[syncToVercel] list deployments failed:",
            redeployError,
          );
        }
      } catch (err) {
        redeployError = `Redeploy exception: ${String(err)}`;
        console.error("[syncToVercel] redeploy exception:", redeployError);
      }
    }

    return {
      hookId: args.hookId,
      provider: "vercel",
      upserted,
      redeployTriggered,
      ...(listError && { error: listError }),
      ...(redeployError && { redeployError }),
    };
  },
});
