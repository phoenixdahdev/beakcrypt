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
import { useState, useTransition, useCallback, useRef } from "react";
import {
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Copy,
  Check,
  Key,
  X,
  Loader2,
  ArrowRightLeft,
  MoreVertical,
  ShieldAlert,
  Lock,
  RotateCcw,
  Pencil,
} from "lucide-react";
import Link from "next/link";
import { SidebarTrigger } from "@beakcrypt/ui/components/sidebar";
import { Button } from "@beakcrypt/ui/components/button";
import { Input } from "@beakcrypt/ui/components/input";
import { Separator } from "@beakcrypt/ui/components/separator";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@beakcrypt/ui/components/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@beakcrypt/ui/components/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@beakcrypt/ui/components/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@beakcrypt/ui/components/dialog";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@beakcrypt/ui/components/empty";
import { Skeleton } from "@beakcrypt/ui/components/skeleton";
import LinkRepoDialog from "./link-repo-dialog";
import { useOrgKey } from "~/hooks/use-org-key";
import { useDeviceKeySetup } from "~/hooks/use-device-key-setup";
import { encryptSecret, decryptSecret } from "~/lib/crypto";

interface ParsedEntry {
  id: string;
  key: string;
  value: string;
}

function parseEnvContent(content: string): ParsedEntry[] {
  const entries: ParsedEntry[] = [];
  const lines = content.split("\n");

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const match = line.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)/i);
    if (!match || !match[1] || match[2] === undefined) continue;

    const key = match[1].toUpperCase();
    let value = match[2];

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    entries.push({ id: crypto.randomUUID(), key, value });
  }

  return entries;
}

export default function ProjectContent({
  project,
  preloadedEnvironments,
}: {
  project: Doc<"projects">;
  preloadedEnvironments: Preloaded<typeof api.environments.list>;
}) {
  const environmentsResult = usePreloadedQuery(preloadedEnvironments);
  const environments = isSuccess(environmentsResult)
    ? environmentsResult.data
    : [];

  const [activeEnvId, setActiveEnvId] = useState<Id<"environments"> | null>(
    null,
  );
  const selectedEnvId = activeEnvId ?? environments[0]?._id ?? null;

  const [addEnvOpen, setAddEnvOpen] = useState(false);

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <SidebarTrigger className="-ml-1" />
          <div>
            <h1 className="text-lg font-semibold tracking-tight">
              {project.name}
            </h1>
            <p className="text-sm text-muted-foreground">
              Manage environment variables for this project.
            </p>
          </div>
        </div>
        <LinkRepoDialog
          projectId={project._id}
          currentRepoName={project.githubRepoName}
        />
      </div>

      <Separator />

      {environments.length > 0 && selectedEnvId ? (
        <Tabs
          value={selectedEnvId}
          onValueChange={(v) => setActiveEnvId(v as Id<"environments">)}
          className="flex-1"
        >
          <div className="flex items-center gap-2 overflow-x-auto overflow-y-hidden px-6 pt-4">
            <TabsList variant="line">
              {environments.map((env) => (
                <TabsTrigger key={env._id} value={env._id}>
                  {env.name}
                  {env.isPersonal && (
                    <Lock className="size-3 text-muted-foreground" />
                  )}
                </TabsTrigger>
              ))}
            </TabsList>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => setAddEnvOpen(true)}
              title="Add environment"
            >
              <Plus className="size-3.5" />
            </Button>
          </div>

          {environments.map((env) => (
            <TabsContent key={env._id} value={env._id} className="px-6 py-4">
              <EnvironmentSecrets
                environmentId={env._id}
                environmentName={env.name}
                isPersonal={env.isPersonal ?? false}
                allEnvironments={environments}
                projectId={project._id}
                orgId={project.orgId}
                onEnvDeleted={() => setActiveEnvId(null)}
              />
            </TabsContent>
          ))}
        </Tabs>
      ) : (
        <Empty className="flex-1">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Key />
            </EmptyMedia>
            <EmptyTitle>No environments</EmptyTitle>
            <EmptyDescription>
              This project has no environments configured.
            </EmptyDescription>
          </EmptyHeader>
          <Button size="sm" onClick={() => setAddEnvOpen(true)}>
            <Plus />
            Add Environment
          </Button>
        </Empty>
      )}

      <CreateEnvironmentDialog
        projectId={project._id}
        environments={environments}
        open={addEnvOpen}
        onOpenChange={setAddEnvOpen}
        onCreated={(envId) => setActiveEnvId(envId)}
      />
    </div>
  );
}

function CreateEnvironmentDialog({
  projectId,
  environments,
  open,
  onOpenChange,
  onCreated,
}: {
  projectId: Id<"projects">;
  environments: Doc<"environments">[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (envId: Id<"environments">) => void;
}) {
  const createEnvMutation = useMutation(api.environments.create);
  const syncMutation = useMutation(api.secrets.syncFromEnvironment);

  const [name, setName] = useState("");
  const [copyFromId, setCopyFromId] = useState<Id<"environments"> | null>(null);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleCreate = () => {
    if (!name.trim()) return;
    const trimmedName = name.trim().toLowerCase();

    if (trimmedName === "local") {
      setError('"local" is reserved for personal environments.');
      return;
    }

    setError("");
    startTransition(async () => {
      try {
        const result = await createEnvMutation({
          name: trimmedName,
          projectId,
        });
        if (isFailure(result)) {
          setError(result.error);
          return;
        }

        const newEnvId = result.data._id;

        if (copyFromId) {
          const syncResult = await syncMutation({
            sourceEnvironmentId: copyFromId,
            targetEnvironmentId: newEnvId,
            overwrite: false,
          });
          if (isFailure(syncResult)) {
            console.error("Sync failed:", syncResult.error);
          }
        }

        handleClose();
        onCreated(newEnvId);
      } catch {
        setError("Something went wrong.");
      }
    });
  };

  const handleClose = () => {
    setName("");
    setCopyFromId(null);
    setError("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>New Environment</DialogTitle>
          <DialogDescription>
            Add a custom environment to this project. Optionally copy secrets
            from an existing one.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="space-y-2">
            <label
              htmlFor="env-name"
              className="text-sm font-medium leading-none"
            >
              Name
            </label>
            <Input
              id="env-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="preview"
              className="font-mono"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleCreate();
                }
              }}
            />
            <p className="text-xs text-muted-foreground">
              Lowercase letters, numbers, and hyphens.
            </p>
          </div>

          {environments.length > 0 && (
            <div className="space-y-2">
              <span className="text-sm font-medium leading-none">
                Copy secrets from
                <span className="ml-1 font-normal text-muted-foreground">
                  (optional)
                </span>
              </span>
              <div className="grid gap-1.5">
                {environments.map((env) => (
                  <button
                    key={env._id}
                    type="button"
                    onClick={() =>
                      setCopyFromId(copyFromId === env._id ? null : env._id)
                    }
                    className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm text-left transition-colors ${
                      copyFromId === env._id
                        ? "border-primary bg-primary/5 text-foreground"
                        : "border-border text-muted-foreground hover:bg-accent/50"
                    }`}
                  >
                    <div
                      className={`size-2 rounded-full ${
                        copyFromId === env._id
                          ? "bg-primary"
                          : "bg-muted-foreground/30"
                      }`}
                    />
                    {env.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {error && (
            <p className="text-sm text-red-400 animate-in fade-in slide-in-from-top-1">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={isPending || !name.trim()}>
            {isPending ? (
              <>
                <Loader2 className="animate-spin" />
                Creating...
              </>
            ) : (
              "Create Environment"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EnvironmentSecrets({
  environmentId,
  environmentName,
  isPersonal,
  allEnvironments,
  projectId,
  orgId,
  onEnvDeleted,
}: {
  environmentId: Id<"environments">;
  environmentName: string;
  isPersonal: boolean;
  allEnvironments: Doc<"environments">[];
  projectId: Id<"projects">;
  orgId: Id<"organizations">;
  onEnvDeleted: () => void;
}) {
  const { orgKey, status: keyStatus } = useOrgKey(orgId);
  const deviceSetup = useDeviceKeySetup(orgId);
  const secretsResult = useQuery(api.secrets.list, { environmentId });
  const createMutation = useMutation(api.secrets.create);
  const bulkCreateMutation = useMutation(api.secrets.bulkCreate);
  const updateMutation = useMutation(api.secrets.update);
  const deleteMutation = useMutation(api.secrets.remove);
  const removeAllMutation = useMutation(api.secrets.removeAll);
  const deleteEnvMutation = useMutation(api.environments.remove);
  const syncMutation = useMutation(api.secrets.syncFromEnvironment);

  const [isPending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<Id<"secrets"> | null>(null);
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [destructiveAction, setDestructiveAction] = useState<
    "delete-env" | "delete-all-secrets" | "reset-local" | null
  >(null);
  const [destructivePending, startDestructiveTransition] = useTransition();
  const [destructiveError, setDestructiveError] = useState("");

  const [addRows, setAddRows] = useState<ParsedEntry[]>([]);
  const [showAddRow, setShowAddRow] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [addError, setAddError] = useState("");
  const keyInputRef = useRef<HTMLInputElement>(null);

  const [editingId, setEditingId] = useState<Id<"secrets"> | null>(null);
  const [editKey, setEditKey] = useState("");
  const [editValue, setEditValue] = useState("");
  const [editError, setEditError] = useState("");
  const [editPending, startEditTransition] = useTransition();

  const [syncOpen, setSyncOpen] = useState(false);
  const [syncSourceId, setSyncSourceId] = useState<Id<"environments"> | null>(
    null,
  );
  const [syncOverwrite, setSyncOverwrite] = useState(false);
  const [syncResult, setSyncResult] = useState<{
    created: number;
    updated: number;
    skipped: number;
  } | null>(null);
  const [syncError, setSyncError] = useState("");
  const [syncPending, startSyncTransition] = useTransition();

  const secrets =
    secretsResult && isSuccess(secretsResult) ? secretsResult.data : null;

  const otherEnvironments = allEnvironments.filter(
    (env) => env._id !== environmentId,
  );

  const devEnv = isPersonal
    ? allEnvironments.find(
        (env) => env.name === "development" && !env.isPersonal,
      )
    : undefined;
  const devSecretsResult = useQuery(
    api.secrets.list,
    devEnv ? { environmentId: devEnv._id } : "skip",
  );
  const devHasSecrets =
    devSecretsResult &&
    isSuccess(devSecretsResult) &&
    devSecretsResult.data.length > 0;

  const [decryptedValues, setDecryptedValues] = useState<
    Record<string, string>
  >({});

  const toggleReveal = async (id: string, encryptedValue: string) => {
    if (revealedIds.has(id)) {
      setRevealedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      return;
    }

    if (!orgKey) return;

    try {
      if (!decryptedValues[id]) {
        const decrypted = await decryptSecret(encryptedValue, orgKey);
        setDecryptedValues((prev) => ({ ...prev, [id]: decrypted }));
      }
      setRevealedIds((prev) => {
        const next = new Set(prev);
        next.add(id);
        return next;
      });
    } catch {
      console.error("Failed to decrypt secret");
    }
  };

  const allRevealed =
    secrets !== null &&
    secrets.length > 0 &&
    secrets.every((s) => revealedIds.has(s._id));

  const toggleRevealAll = async () => {
    if (!secrets || secrets.length === 0) return;

    if (allRevealed) {
      setRevealedIds(new Set());
      return;
    }

    if (!orgKey) return;

    try {
      const toDecrypt = secrets.filter((s) => !decryptedValues[s._id]);
      if (toDecrypt.length > 0) {
        const results = await Promise.all(
          toDecrypt.map(async (s) => ({
            id: s._id,
            value: await decryptSecret(s.encryptedValue, orgKey),
          })),
        );
        setDecryptedValues((prev) => {
          const next = { ...prev };
          for (const r of results) next[r.id] = r.value;
          return next;
        });
      }
      setRevealedIds(new Set(secrets.map((s) => s._id)));
    } catch {
      console.error("Failed to decrypt secrets");
    }
  };

  const handleCopy = async (id: string, encryptedValue: string) => {
    if (!orgKey) return;

    try {
      const decrypted =
        decryptedValues[id] ?? (await decryptSecret(encryptedValue, orgKey));
      await navigator.clipboard.writeText(decrypted);
      setDecryptedValues((prev) => ({ ...prev, [id]: decrypted }));
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      console.error("Failed to decrypt secret for copy");
    }
  };

  const handleDelete = (id: Id<"secrets">) => {
    setDeletingId(id);
    startTransition(async () => {
      try {
        await deleteMutation({ id });
      } catch (error) {
        console.error("Failed to delete secret:", error);
      } finally {
        setDeletingId(null);
      }
    });
  };

  const handleEditStart = async (secret: Doc<"secrets">) => {
    setEditingId(secret._id);
    setEditKey(secret.key);
    setEditError("");
    if (orgKey) {
      try {
        const decrypted =
          decryptedValues[secret._id] ??
          (await decryptSecret(secret.encryptedValue, orgKey));
        setDecryptedValues((prev) => ({ ...prev, [secret._id]: decrypted }));
        setEditValue(decrypted);
      } catch {
        setEditValue("");
      }
    } else {
      setEditValue("");
    }
  };

  const handleEditSave = (id: Id<"secrets">) => {
    if (!editKey.trim()) {
      setEditError("Key is required");
      return;
    }
    if (!orgKey) {
      setEditError("Encryption key not available");
      return;
    }
    setEditError("");
    startEditTransition(async () => {
      try {
        const encrypted = await encryptSecret(editValue, orgKey);
        const result = await updateMutation({
          id,
          key: editKey.trim().toUpperCase(),
          encryptedValue: encrypted,
        });
        if (isFailure(result)) {
          setEditError(result.error);
          return;
        }
        setDecryptedValues((prev) => ({ ...prev, [id]: editValue }));
        setEditingId(null);
        setEditKey("");
        setEditValue("");
      } catch {
        setEditError("Something went wrong.");
      }
    });
  };

  const handleEditCancel = () => {
    setEditingId(null);
    setEditKey("");
    setEditValue("");
    setEditError("");
  };

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLInputElement>) => {
      const text = e.clipboardData.getData("text/plain");
      if (!text.includes("=") || !text.includes("\n")) return;

      e.preventDefault();
      const parsed = parseEnvContent(text);
      if (parsed.length > 0) {
        setAddRows(parsed);
        setShowAddRow(false);
        setNewKey("");
        setNewValue("");
      }
    },
    [],
  );

  const handleAddSingle = () => {
    if (!newKey.trim()) {
      setAddError("Key is required");
      return;
    }
    if (!orgKey) {
      setAddError("Encryption key not available");
      return;
    }
    setAddError("");
    startTransition(async () => {
      try {
        const encrypted = await encryptSecret(newValue, orgKey);
        const result = await createMutation({
          environmentId,
          key: newKey.trim().toUpperCase(),
          encryptedValue: encrypted,
        });
        if (isFailure(result)) {
          setAddError(result.error);
          return;
        }
        setNewKey("");
        setNewValue("");
        setShowAddRow(false);
      } catch {
        setAddError("Something went wrong.");
      }
    });
  };

  const handleAddBulk = () => {
    if (addRows.length === 0) return;
    if (!orgKey) {
      setAddError("Encryption key not available");
      return;
    }
    setAddError("");
    startTransition(async () => {
      try {
        const encryptedSecrets = await Promise.all(
          addRows.map(async (r) => ({
            key: r.key,
            encryptedValue: await encryptSecret(r.value, orgKey),
          })),
        );
        const result = await bulkCreateMutation({
          environmentId,
          secrets: encryptedSecrets,
          overwrite: true,
        });
        if (isFailure(result)) {
          setAddError(result.error);
          return;
        }
        setAddRows([]);
      } catch {
        setAddError("Something went wrong.");
      }
    });
  };

  const removeAddRow = (index: number) => {
    setAddRows((prev) => prev.filter((_, i) => i !== index));
  };

  const updateAddRow = (index: number, field: "key" | "value", val: string) => {
    setAddRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: val } : row)),
    );
  };

  const handleSync = () => {
    if (!syncSourceId) return;
    setSyncError("");
    startSyncTransition(async () => {
      try {
        const result = await syncMutation({
          sourceEnvironmentId: syncSourceId,
          targetEnvironmentId: environmentId,
          overwrite: syncOverwrite,
        });
        if (isFailure(result)) {
          setSyncError(result.error);
          return;
        }
        setSyncResult(result.data);
      } catch {
        setSyncError("Something went wrong.");
      }
    });
  };

  const handleSyncClose = () => {
    setSyncOpen(false);
    setSyncSourceId(null);
    setSyncOverwrite(false);
    setSyncResult(null);
    setSyncError("");
  };

  const ensureLocalMutation = useMutation(api.environments.ensurePersonalLocal);

  const handleDestructiveConfirm = () => {
    setDestructiveError("");
    startDestructiveTransition(async () => {
      try {
        if (destructiveAction === "delete-env") {
          const result = await deleteEnvMutation({ id: environmentId });
          if (isFailure(result)) {
            setDestructiveError(result.error);
            return;
          }
          setDestructiveAction(null);
          onEnvDeleted();
        } else if (destructiveAction === "reset-local") {
          const result = await removeAllMutation({ environmentId });
          if (isFailure(result)) {
            setDestructiveError(result.error);
            return;
          }
          try {
            const syncResult = await ensureLocalMutation({
              projectId,
              syncFromDev: true,
            });
            if (isFailure(syncResult)) {
              setDestructiveError(
                `Partial success: secrets removed but sync failed — ${syncResult.error}`,
              );
              return;
            }
          } catch (syncErr) {
            setDestructiveError(
              `Partial success: secrets removed but sync failed — ${syncErr instanceof Error ? syncErr.message : "Unknown error"}`,
            );
            return;
          }
          setDestructiveAction(null);
        } else if (destructiveAction === "delete-all-secrets") {
          const result = await removeAllMutation({ environmentId });
          if (isFailure(result)) {
            setDestructiveError(result.error);
            return;
          }
          setDestructiveAction(null);
        }
      } catch {
        setDestructiveError("Something went wrong.");
      }
    });
  };

  const handleDestructiveClose = () => {
    setDestructiveAction(null);
    setDestructiveError("");
  };

  if (secrets === null) {
    return <SecretsTableSkeleton />;
  }

  if (keyStatus === "loading") {
    return <SecretsTableSkeleton />;
  }

  if (keyStatus === "pending_approval") {
    return (
      <Empty className="min-h-[40vh]">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Lock />
          </EmptyMedia>
          <EmptyTitle>Encryption Key Pending</EmptyTitle>
          <EmptyDescription>
            Your encryption key is awaiting admin approval. You will be able to
            view and manage secrets once an admin approves your key.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  if (keyStatus === "no_key_pair") {
    if (deviceSetup.status === "registering") {
      return (
        <Empty className="min-h-[40vh]">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ShieldAlert />
            </EmptyMedia>
            <EmptyTitle>Setting up this device…</EmptyTitle>
            <EmptyDescription>
              Generating encryption keys for this device.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      );
    }

    if (deviceSetup.status === "pending_approval") {
      return (
        <Empty className="min-h-[40vh]">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ShieldAlert />
            </EmptyMedia>
            <EmptyTitle>Pending Approval</EmptyTitle>
            <EmptyDescription>
              This device has been registered and is waiting for approval.
              Approve it from an authorized device in your Sessions page, or ask
              an admin.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      );
    }

    if (deviceSetup.status === "error") {
      return (
        <Empty className="min-h-[40vh]">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ShieldAlert />
            </EmptyMedia>
            <EmptyTitle>Device Setup Failed</EmptyTitle>
            <EmptyDescription>
              {deviceSetup.error || "Failed to register this device."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      );
    }

    return (
      <Empty className="min-h-[40vh]">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ShieldAlert />
          </EmptyMedia>
          <EmptyTitle>Private Key Not Found</EmptyTitle>
          <EmptyDescription>
            Your encryption private key was not found in this browser. This can
            happen if you cleared your browser data or switched devices.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  if (keyStatus === "error") {
    return (
      <Empty className="min-h-[40vh]">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ShieldAlert />
          </EmptyMedia>
          <EmptyTitle>Encryption Error</EmptyTitle>
          <EmptyDescription>
            There was a problem with your encryption key. Contact an admin for
            assistance.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const hasSecrets = secrets.length > 0;
  const hasPendingRows = addRows.length > 0;
  const hasSyncTargets = otherEnvironments.length > 0;

  return (
    <div className="flex flex-col gap-4">
      {!hasSecrets && !showAddRow && !hasPendingRows && (
        <Empty className="min-h-[40vh]">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              {isPersonal ? <Lock /> : <Key />}
            </EmptyMedia>
            <EmptyTitle>
              {isPersonal
                ? "Your personal local environment"
                : `No secrets in ${environmentName}`}
            </EmptyTitle>
            <EmptyDescription>
              {isPersonal
                ? "This is your private workspace. Add secrets here to override values for local development — only you can see them."
                : `Add secrets one at a time, paste an .env file${hasSyncTargets ? ", or sync from another environment" : ""}.`}
            </EmptyDescription>
          </EmptyHeader>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => {
                setShowAddRow(true);
                setTimeout(() => keyInputRef.current?.focus(), 0);
              }}
            >
              <Plus />
              Add Secret
            </Button>
            {isPersonal && devHasSecrets ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setDestructiveAction("reset-local")}
              >
                <RotateCcw />
                Reset Environment
              </Button>
            ) : (
              hasSyncTargets && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSyncOpen(true)}
                >
                  <ArrowRightLeft />
                  Sync from...
                </Button>
              )
            )}
          </div>
        </Empty>
      )}

      {(hasSecrets || showAddRow || hasPendingRows) && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {secrets.length} secret{secrets.length !== 1 ? "s" : ""}
            </p>
            <div className="flex items-center gap-2">
              {hasSyncTargets && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSyncOpen(true)}
                >
                  <ArrowRightLeft />
                  Sync
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                disabled={showAddRow || hasPendingRows}
                onClick={() => {
                  setShowAddRow(true);
                  setTimeout(() => keyInputRef.current?.focus(), 0);
                }}
              >
                <Plus />
                Add
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm" title="More options">
                    <MoreVertical className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {hasSecrets && (
                    <DropdownMenuItem onClick={toggleRevealAll}>
                      {allRevealed ? <EyeOff /> : <Eye />}
                      {allRevealed ? "Hide all secrets" : "Reveal all secrets"}
                    </DropdownMenuItem>
                  )}
                  {hasSecrets && (
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => setDestructiveAction("delete-all-secrets")}
                    >
                      <Trash2 />
                      Delete all secrets
                    </DropdownMenuItem>
                  )}
                  {isPersonal ? (
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => setDestructiveAction("reset-local")}
                    >
                      <RotateCcw />
                      Reset local environment
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => setDestructiveAction("delete-env")}
                    >
                      <Trash2 />
                      Delete environment
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[35%]">Key</TableHead>
                  <TableHead className="w-[50%]">Value</TableHead>
                  <TableHead className="w-[15%] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {showAddRow && !hasPendingRows && (
                  <TableRow className="bg-muted/30">
                    <TableCell>
                      <Input
                        ref={keyInputRef}
                        value={newKey}
                        onChange={(e) => setNewKey(e.target.value)}
                        onPaste={handlePaste}
                        placeholder="KEY_NAME"
                        className="h-8 font-mono text-sm"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddSingle();
                          }
                          if (e.key === "Escape") {
                            setShowAddRow(false);
                            setNewKey("");
                            setNewValue("");
                          }
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={newValue}
                        onChange={(e) => setNewValue(e.target.value)}
                        onPaste={handlePaste}
                        placeholder="value"
                        className="h-8 font-mono text-sm"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddSingle();
                          }
                          if (e.key === "Escape") {
                            setShowAddRow(false);
                            setNewKey("");
                            setNewValue("");
                          }
                        }}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-0.5">
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={handleAddSingle}
                          disabled={isPending || !newKey.trim()}
                          title="Save"
                        >
                          {isPending ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <Check className="size-3.5 text-emerald-500" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => {
                            setShowAddRow(false);
                            setNewKey("");
                            setNewValue("");
                            setAddError("");
                          }}
                          title="Cancel"
                        >
                          <X className="size-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )}

                {addRows.map((row, index) => (
                  <TableRow key={row.id} className="bg-emerald-500/5">
                    <TableCell>
                      <Input
                        value={row.key}
                        onChange={(e) =>
                          updateAddRow(index, "key", e.target.value)
                        }
                        className="h-8 font-mono text-sm"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={row.value}
                        onChange={(e) =>
                          updateAddRow(index, "value", e.target.value)
                        }
                        className="h-8 font-mono text-sm"
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => removeAddRow(index)}
                        title="Remove"
                      >
                        <X className="size-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}

                {secrets.map((secret) => {
                  const isRevealed = revealedIds.has(secret._id);
                  const isDeleting = deletingId === secret._id;
                  const isCopied = copiedId === secret._id;
                  const isEditing = editingId === secret._id;

                  if (isEditing) {
                    return (
                      <TableRow key={secret._id} className="bg-muted/30">
                        <TableCell>
                          <Input
                            value={editKey}
                            onChange={(e) => setEditKey(e.target.value)}
                            placeholder="KEY_NAME"
                            className="h-8 font-mono text-sm"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleEditSave(secret._id);
                              }
                              if (e.key === "Escape") handleEditCancel();
                            }}
                            autoFocus
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            placeholder="value"
                            className="h-8 font-mono text-sm"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleEditSave(secret._id);
                              }
                              if (e.key === "Escape") handleEditCancel();
                            }}
                          />
                          {editError && (
                            <p className="mt-1 text-xs text-red-400">
                              {editError}
                            </p>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-0.5">
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              onClick={() => handleEditSave(secret._id)}
                              disabled={editPending || !editKey.trim()}
                              title="Save"
                            >
                              {editPending ? (
                                <Loader2 className="size-3.5 animate-spin" />
                              ) : (
                                <Check className="size-3.5 text-emerald-500" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              onClick={handleEditCancel}
                              title="Cancel"
                            >
                              <X className="size-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  }

                  return (
                    <TableRow
                      key={secret._id}
                      className={isDeleting ? "opacity-50" : ""}
                    >
                      <TableCell className="font-mono text-sm font-medium">
                        {secret.key}
                      </TableCell>
                      <TableCell className="font-mono text-sm text-muted-foreground">
                        <span className="block max-w-md truncate">
                          {isRevealed
                            ? (decryptedValues[secret._id] ?? "Decrypting...")
                            : "•".repeat(16)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-0.5">
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={() =>
                              toggleReveal(secret._id, secret.encryptedValue)
                            }
                            title={isRevealed ? "Hide value" : "Reveal value"}
                          >
                            {isRevealed ? (
                              <EyeOff className="size-3.5" />
                            ) : (
                              <Eye className="size-3.5" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={() =>
                              handleCopy(secret._id, secret.encryptedValue)
                            }
                            title="Copy value"
                          >
                            {isCopied ? (
                              <Check className="size-3.5 text-emerald-500" />
                            ) : (
                              <Copy className="size-3.5" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => handleEditStart(secret)}
                            disabled={isDeleting || editingId !== null}
                            title="Edit secret"
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            disabled={isDeleting || editingId !== null}
                            onClick={() => handleDelete(secret._id)}
                            className="text-destructive hover:text-destructive"
                            title="Delete secret"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {hasPendingRows && (
            <div className="flex flex-col gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">
                  {addRows.length}
                </span>{" "}
                variable{addRows.length !== 1 ? "s" : ""} parsed from paste.
                Existing keys will be overwritten.
              </p>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setAddRows([])}
                >
                  Discard
                </Button>
                <Button size="sm" onClick={handleAddBulk} disabled={isPending}>
                  {isPending ? (
                    <>
                      <Loader2 className="animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <Check />
                      Import All
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {addError && (
            <p className="text-sm text-red-400 animate-in fade-in slide-in-from-top-1">
              {addError}
            </p>
          )}
        </>
      )}

      <Dialog open={syncOpen} onOpenChange={handleSyncClose}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Sync Secrets</DialogTitle>
            <DialogDescription>
              Copy secret keys from another environment into{" "}
              <span className="font-medium text-foreground">
                {environmentName}
              </span>
              .
            </DialogDescription>
          </DialogHeader>

          {syncResult ? (
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="rounded-full bg-emerald-500/10 p-3 ring-1 ring-emerald-500/20">
                <Check className="size-5 text-emerald-400" />
              </div>
              <div className="text-center space-y-1">
                <p className="font-medium text-sm">Sync Complete</p>
                <p className="text-xs text-muted-foreground">
                  {syncResult.created > 0 && <>{syncResult.created} created</>}
                  {syncResult.updated > 0 && (
                    <>
                      {syncResult.created > 0 ? ", " : ""}
                      {syncResult.updated} updated
                    </>
                  )}
                  {syncResult.skipped > 0 && (
                    <>
                      {syncResult.created > 0 || syncResult.updated > 0
                        ? ", "
                        : ""}
                      {syncResult.skipped} skipped
                    </>
                  )}
                </p>
              </div>
              <Button size="sm" onClick={handleSyncClose}>
                Done
              </Button>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                <span className="text-sm font-medium leading-none">
                  Source environment
                </span>
                <div className="grid gap-1.5">
                  {otherEnvironments.map((env) => (
                    <button
                      key={env._id}
                      type="button"
                      onClick={() => setSyncSourceId(env._id)}
                      className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm text-left transition-colors ${
                        syncSourceId === env._id
                          ? "border-primary bg-primary/5 text-foreground"
                          : "border-border text-muted-foreground hover:bg-accent/50"
                      }`}
                    >
                      <div
                        className={`size-2 rounded-full ${
                          syncSourceId === env._id
                            ? "bg-primary"
                            : "bg-muted-foreground/30"
                        }`}
                      />
                      {env.name}
                    </button>
                  ))}
                </div>

                <label className="flex items-center gap-2 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={syncOverwrite}
                    onChange={(e) => setSyncOverwrite(e.target.checked)}
                    className="rounded border-zinc-700"
                  />
                  <span className="text-sm text-muted-foreground">
                    Overwrite existing keys
                  </span>
                </label>
              </div>

              {syncError && (
                <p className="text-sm text-red-400 animate-in fade-in slide-in-from-top-1">
                  {syncError}
                </p>
              )}

              <DialogFooter>
                <Button variant="outline" onClick={handleSyncClose}>
                  Cancel
                </Button>
                <Button
                  onClick={handleSync}
                  disabled={syncPending || !syncSourceId}
                >
                  {syncPending ? (
                    <>
                      <Loader2 className="animate-spin" />
                      Syncing...
                    </>
                  ) : (
                    <>
                      <ArrowRightLeft />
                      Sync
                    </>
                  )}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={destructiveAction !== null}
        onOpenChange={handleDestructiveClose}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {destructiveAction === "delete-env"
                ? "Delete Environment"
                : destructiveAction === "reset-local"
                  ? "Reset Local Environment"
                  : "Delete All Secrets"}
            </DialogTitle>
            <DialogDescription>
              {destructiveAction === "delete-env" ? (
                <>
                  Are you sure you want to delete{" "}
                  <span className="font-medium text-foreground">
                    {environmentName}
                  </span>
                  ? This will permanently remove the environment and all its
                  secrets. This action cannot be undone.
                </>
              ) : destructiveAction === "reset-local" ? (
                <>
                  This will delete all secrets in your personal{" "}
                  <span className="font-medium text-foreground">local</span>{" "}
                  environment and re-sync them from{" "}
                  <span className="font-medium text-foreground">
                    development
                  </span>
                  . Any custom overrides will be lost.
                </>
              ) : (
                <>
                  This will permanently delete all{" "}
                  <span className="font-medium text-foreground">
                    {secrets.length}
                  </span>{" "}
                  secret{secrets.length !== 1 ? "s" : ""} in{" "}
                  <span className="font-medium text-foreground">
                    {environmentName}
                  </span>
                  . This action cannot be undone.
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {destructiveError && (
            <p className="text-sm text-red-400 animate-in fade-in slide-in-from-top-1">
              {destructiveError}
            </p>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={handleDestructiveClose}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDestructiveConfirm}
              disabled={destructivePending}
            >
              {destructivePending ? (
                <>
                  <Loader2 className="animate-spin" />
                  {destructiveAction === "reset-local"
                    ? "Resetting..."
                    : "Deleting..."}
                </>
              ) : (
                <>
                  {destructiveAction === "reset-local" ? (
                    <RotateCcw />
                  ) : (
                    <Trash2 />
                  )}
                  {destructiveAction === "reset-local" ? "Reset" : "Delete"}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SecretsTableSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-20" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-20 rounded-md" />
          <Skeleton className="h-8 w-20 rounded-md" />
        </div>
      </div>
      <div className="rounded-lg border">
        <div className="divide-y">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 flex-1 max-w-xs" />
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
