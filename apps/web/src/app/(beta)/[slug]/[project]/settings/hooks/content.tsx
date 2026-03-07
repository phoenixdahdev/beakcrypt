"use client";

import {
  type Preloaded,
  usePreloadedQuery,
  useQuery,
  useMutation,
} from "convex/react";
import { api } from "@beakcrypt/convex";
import { isSuccess, isFailure } from "@beakcrypt/shared";
import type { Doc, Id } from "@beakcrypt/convex/dataModel";
import { useState, useTransition } from "react";
import {
  Plus,
  Trash2,
  Loader2,
  Webhook,
  Eye,
  EyeOff,
  Pencil,
  Check,
  ArrowLeft,
} from "lucide-react";
import Link from "next/link";
import { SidebarTrigger } from "@beakcrypt/ui/components/sidebar";
import { Button } from "@beakcrypt/ui/components/button";
import { Input } from "@beakcrypt/ui/components/input";
import { Separator } from "@beakcrypt/ui/components/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@beakcrypt/ui/components/dialog";
import { Badge } from "@beakcrypt/ui/components/badge";

interface Props {
  slug: string;
  project: Doc<"projects">;
  preloadedEnvironments: Preloaded<typeof api.environments.list>;
}

type HookFormState = {
  environmentId: Id<"environments"> | "";
  providerProjectId: string;
  providerTeamId: string;
  vercelApiToken: string;
  targetEnvironment: "production" | "preview" | "development";
  triggerRedeploy: boolean;
};

const defaultFormState: HookFormState = {
  environmentId: "",
  providerProjectId: "",
  providerTeamId: "",
  vercelApiToken: "",
  targetEnvironment: "production",
  triggerRedeploy: false,
};

export default function HooksContent({
  slug,
  project,
  preloadedEnvironments,
}: Props) {
  const environmentsResult = usePreloadedQuery(preloadedEnvironments);
  const environments =
    environmentsResult && isSuccess(environmentsResult)
      ? environmentsResult.data.filter(
          (e) => !e.deletedAt && !e.isPersonal,
        )
      : [];

  const [selectedEnvId, setSelectedEnvId] = useState<
    Id<"environments"> | null
  >(null);

  const effectiveEnvId = selectedEnvId ?? environments[0]?._id ?? null;

  const hooksResult = useQuery(
    api.deploymentHooks.list,
    effectiveEnvId ? { environmentId: effectiveEnvId } : "skip",
  );

  const hooks =
    hooksResult && isSuccess(hooksResult) ? hooksResult.data : [];

  const createMutation = useMutation(api.deploymentHooks.create);
  const updateMutation = useMutation(api.deploymentHooks.update);
  const removeMutation = useMutation(api.deploymentHooks.remove);

  const [createOpen, setCreateOpen] = useState(false);
  const [editHook, setEditHook] = useState<Doc<"deploymentHooks"> | null>(
    null,
  );
  const [deleteHookId, setDeleteHookId] = useState<Id<"deploymentHooks"> | null>(
    null,
  );

  const [form, setForm] = useState<HookFormState>(defaultFormState);
  const [showToken, setShowToken] = useState(false);
  const [formError, setFormError] = useState("");
  const [isPending, startTransition] = useTransition();

  const openCreate = () => {
    setForm({
      ...defaultFormState,
      environmentId: effectiveEnvId ?? "",
    });
    setFormError("");
    setShowToken(false);
    setCreateOpen(true);
  };

  const openEdit = (hook: Doc<"deploymentHooks">) => {
    setForm({
      environmentId: hook.environmentId,
      providerProjectId: hook.providerProjectId,
      providerTeamId: hook.providerTeamId ?? "",
      vercelApiToken: hook.vercelApiToken,
      targetEnvironment: hook.targetEnvironment,
      triggerRedeploy: hook.triggerRedeploy,
    });
    setFormError("");
    setShowToken(false);
    setEditHook(hook);
  };

  const handleCreate = () => {
    if (!form.environmentId) {
      setFormError("Please select an environment.");
      return;
    }
    if (!form.providerProjectId.trim()) {
      setFormError("Vercel project ID is required.");
      return;
    }
    if (!form.vercelApiToken.trim()) {
      setFormError("Vercel API token is required.");
      return;
    }
    setFormError("");
    startTransition(async () => {
      try {
        const result = await createMutation({
          environmentId: form.environmentId as Id<"environments">,
          providerProjectId: form.providerProjectId.trim(),
          providerTeamId: form.providerTeamId.trim() || undefined,
          vercelApiToken: form.vercelApiToken.trim(),
          targetEnvironment: form.targetEnvironment,
          triggerRedeploy: form.triggerRedeploy,
        });
        if (isFailure(result)) {
          setFormError(result.error);
          return;
        }
        setCreateOpen(false);
        setForm(defaultFormState);
      } catch {
        setFormError("Something went wrong. Please try again.");
      }
    });
  };

  const handleUpdate = () => {
    if (!editHook) return;
    if (!form.providerProjectId.trim()) {
      setFormError("Vercel project ID is required.");
      return;
    }
    if (!form.vercelApiToken.trim()) {
      setFormError("Vercel API token is required.");
      return;
    }
    setFormError("");
    startTransition(async () => {
      try {
        const result = await updateMutation({
          id: editHook._id,
          providerProjectId: form.providerProjectId.trim(),
          providerTeamId: form.providerTeamId.trim() || undefined,
          vercelApiToken: form.vercelApiToken.trim(),
          targetEnvironment: form.targetEnvironment,
          triggerRedeploy: form.triggerRedeploy,
        });
        if (isFailure(result)) {
          setFormError(result.error);
          return;
        }
        setEditHook(null);
      } catch {
        setFormError("Something went wrong. Please try again.");
      }
    });
  };

  const handleDelete = () => {
    if (!deleteHookId) return;
    startTransition(async () => {
      try {
        const result = await removeMutation({ id: deleteHookId });
        if (isFailure(result)) return;
        setDeleteHookId(null);
      } catch {
        // ignore - mutation errors surfaced via isFailure check above
      }
    });
  };

  const targetEnvOptions: { value: "production" | "preview" | "development"; label: string }[] = [
    { value: "production", label: "Production" },
    { value: "preview", label: "Preview" },
    { value: "development", label: "Development" },
  ];

  const HookForm = (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">Environment</label>
        <select
          value={form.environmentId}
          onChange={(e) =>
            setForm((f) => ({
              ...f,
              environmentId: e.target.value as Id<"environments">,
            }))
          }
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <option value="">Select environment…</option>
          {environments.map((env) => (
            <option key={env._id} value={env._id}>
              {env.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">Vercel Project ID</label>
        <Input
          value={form.providerProjectId}
          onChange={(e) =>
            setForm((f) => ({ ...f, providerProjectId: e.target.value }))
          }
          placeholder="prj_xxxxxxxxxxxx"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">Vercel Team ID <span className="text-muted-foreground font-normal">(optional)</span></label>
        <Input
          value={form.providerTeamId}
          onChange={(e) =>
            setForm((f) => ({ ...f, providerTeamId: e.target.value }))
          }
          placeholder="team_xxxxxxxxxxxx"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">Vercel API Token</label>
        <div className="relative">
          <Input
            type={showToken ? "text" : "password"}
            value={form.vercelApiToken}
            onChange={(e) =>
              setForm((f) => ({ ...f, vercelApiToken: e.target.value }))
            }
            placeholder="xxxxxxxxxxxxxxxxxxxxxxxx"
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowToken((v) => !v)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label={showToken ? "Hide token" : "Show token"}
          >
            {showToken ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">Target Environment</label>
        <select
          value={form.targetEnvironment}
          onChange={(e) =>
            setForm((f) => ({
              ...f,
              targetEnvironment: e.target.value as typeof form.targetEnvironment,
            }))
          }
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          {targetEnvOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">
          The Vercel environment target where secrets will be synced.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <input
          id="trigger-redeploy"
          type="checkbox"
          checked={form.triggerRedeploy}
          onChange={(e) =>
            setForm((f) => ({ ...f, triggerRedeploy: e.target.checked }))
          }
          className="size-4 rounded border-input"
        />
        <label htmlFor="trigger-redeploy" className="text-sm">
          Trigger redeployment after sync
        </label>
      </div>
    </div>
  );

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center gap-3 px-6 py-4">
        <SidebarTrigger className="-ml-1" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-0.5">
            <Link
              href={`/${slug}/${encodeURIComponent(project.name)}`}
              className="flex items-center gap-1 hover:text-foreground transition-colors"
            >
              <ArrowLeft className="size-3" />
              {project.name}
            </Link>
          </div>
          <h1 className="text-lg font-semibold tracking-tight">
            Deployment Hooks
          </h1>
          <p className="text-sm text-muted-foreground">
            Automatically sync secrets to external providers when you push.
          </p>
        </div>
        <Button size="sm" onClick={openCreate} disabled={environments.length === 0}>
          <Plus />
          Add Hook
        </Button>
      </div>

      <Separator />

      {/* Environment tabs */}
      {environments.length > 1 && (
        <div className="flex items-center gap-1 px-6 pt-4 flex-wrap">
          {environments.map((env) => (
            <button
              key={env._id}
              type="button"
              onClick={() => setSelectedEnvId(env._id)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                effectiveEnvId === env._id
                  ? "bg-secondary text-secondary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              }`}
            >
              {env.name}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 p-6">
        {environments.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-12 text-center">
            <Webhook className="size-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No environments found for this project.
            </p>
          </div>
        ) : hooksResult === undefined ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : hooks.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-12 text-center">
            <Webhook className="size-10 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">No deployment hooks yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Add a hook to automatically sync secrets to Vercel on push.
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={openCreate}>
              <Plus />
              Add Hook
            </Button>
          </div>
        ) : (
          <div className="max-w-2xl space-y-3">
            {hooks.map((hook) => (
              <div
                key={hook._id}
                className="flex items-start gap-4 rounded-lg border p-4"
              >
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted">
                  <Webhook className="size-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium font-mono">
                      {hook.providerProjectId}
                    </span>
                    <Badge variant="secondary" className="text-xs capitalize">
                      {hook.provider}
                    </Badge>
                    <Badge variant="outline" className="text-xs capitalize">
                      {hook.targetEnvironment}
                    </Badge>
                    {hook.triggerRedeploy && (
                      <Badge variant="outline" className="text-xs">
                        auto-deploy
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {hook.providerTeamId
                      ? `Team: ${hook.providerTeamId}`
                      : "Personal account"}
                    {" · "}
                    Token: ••••••••
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    onClick={() => openEdit(hook)}
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-destructive hover:text-destructive"
                    onClick={() => setDeleteHookId(hook._id)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={(open) => { if (!isPending) setCreateOpen(open); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Deployment Hook</DialogTitle>
            <DialogDescription>
              Sync secrets to Vercel whenever you push to this environment.
            </DialogDescription>
          </DialogHeader>
          {HookForm}
          {formError && (
            <p className="text-sm text-red-400 animate-in fade-in slide-in-from-top-1">
              {formError}
            </p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="animate-spin" />
                  Creating…
                </>
              ) : (
                <>
                  <Check />
                  Create Hook
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editHook} onOpenChange={(open) => { if (!open && !isPending) setEditHook(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Deployment Hook</DialogTitle>
            <DialogDescription>
              Update the configuration for this deployment hook.
            </DialogDescription>
          </DialogHeader>
          {HookForm}
          {formError && (
            <p className="text-sm text-red-400 animate-in fade-in slide-in-from-top-1">
              {formError}
            </p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditHook(null)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <Check />
                  Save Changes
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm dialog */}
      <Dialog
        open={!!deleteHookId}
        onOpenChange={(open) => {
          if (!open && !isPending) setDeleteHookId(null);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Deployment Hook</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this deployment hook? This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteHookId(null)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isPending}
            >
              {isPending ? (
                <>
                  <Loader2 className="animate-spin" />
                  Deleting…
                </>
              ) : (
                <>
                  <Trash2 />
                  Delete Hook
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
