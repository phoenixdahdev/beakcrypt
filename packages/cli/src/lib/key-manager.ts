import ora from "ora";
import open from "open";
import {
  generateKeyPair,
  unwrapOrgKey as cryptoUnwrapOrgKey,
} from "@beakcrypt/crypto";
import { api } from "@beakcrypt/convex";
import { query, mutation, getSessionToken, getSiteUrl } from "./convex-client";
import {
  getStoredKey,
  saveKey,
  updateWrappedOrgKey,
  type StoredKeyData,
} from "./key-store";
import { unwrapResult } from "./errors";
import { getProjectConfig } from "./project-config";
import * as output from "./output";

export async function ensureOrgKey(orgId: string): Promise<string> {
  const stored = await getStoredKey(orgId);

  if (stored?.wrappedOrgKey) {
    return await cryptoUnwrapOrgKey(stored.wrappedOrgKey, stored.privateKey);
  }

  if (stored?.keyId) {
    // Key exists but no wrapped org key — check backend for approval
    const keyResult = await query(api.keys.getMyKey, {
      orgId: orgId as never,
      publicKey: JSON.stringify(stored.publicKey),
    });
    const keyRecord = unwrapResult(keyResult);

    if (keyRecord?.status === "active" && keyRecord.wrappedOrgKey) {
      await updateWrappedOrgKey(orgId, keyRecord.wrappedOrgKey);
      return await cryptoUnwrapOrgKey(
        keyRecord.wrappedOrgKey,
        stored.privateKey,
      );
    }

    if (keyRecord?.status === "pending") {
      return await waitForApproval(orgId, stored);
    }

    throw new Error(
      "Device key is not active. An admin may need to approve this device.",
    );
  }

  // No key pair — register new device
  return await registerNewDevice(orgId);
}

async function registerNewDevice(orgId: string): Promise<string> {
  const sessionToken = getSessionToken();
  if (!sessionToken) throw new Error("Not logged in");

  const spinner = ora("Generating device keys...").start();

  let keyPair: Awaited<ReturnType<typeof generateKeyPair>>;
  let keyRecord: ReturnType<typeof unwrapResult<any>>;

  try {
    keyPair = await generateKeyPair();

    spinner.text = "Registering device with organization...";

    const result = await mutation(api.keys.registerKey, {
      orgId: orgId as never,
      publicKey: JSON.stringify(keyPair.publicKey),
      sessionToken,
    });

    keyRecord = unwrapResult(result);
    spinner.stop();
  } catch (err) {
    spinner.fail("Device registration failed.");
    throw err;
  }

  const stored: StoredKeyData = {
    publicKey: keyPair.publicKey,
    privateKey: keyPair.privateKey,
    keyId: keyRecord._id,
    wrappedOrgKey: keyRecord.wrappedOrgKey,
  };

  await saveKey(orgId, stored);

  if (keyRecord.status === "active" && keyRecord.wrappedOrgKey) {
    output.success("Device registered and activated.");
    return await cryptoUnwrapOrgKey(
      keyRecord.wrappedOrgKey,
      keyPair.privateKey,
    );
  }

  // Pending approval
  return await waitForApproval(orgId, stored);
}

const APPROVAL_TIMEOUT_MS = 60_000;

async function waitForApproval(
  orgId: string,
  stored: StoredKeyData,
): Promise<string> {
  // Try to open the browser for auto-approval (same-user, new device scenario)
  try {
    const projectConfig = await getProjectConfig();
    if (projectConfig?.orgSlug && stored.keyId) {
      const siteUrl = getSiteUrl();
      const approveUrl = `${siteUrl}/${projectConfig.orgSlug}/sessions?approveSession=${stored.keyId}`;

      output.info("Opening browser to approve this device...");
      console.log(`${output.dim("If the browser doesn't open, visit:")}`);
      console.log(`${output.link(approveUrl)}\n`);

      try {
        await open(approveUrl);
      } catch {
        // Browser failed to open — URL already printed above
      }
    }
  } catch {
    // Could not determine approval URL — fall through to polling
  }

  const spinner = ora("Waiting for device to be approved...").start();
  spinner.indent = 2;

  const deadline = Date.now() + APPROVAL_TIMEOUT_MS;

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 5000));

    const result = await query(api.keys.getMyKey, {
      orgId: orgId as never,
      publicKey: JSON.stringify(stored.publicKey),
    });
    const keyRecord = unwrapResult(result);

    if (keyRecord?.status === "active" && keyRecord.wrappedOrgKey) {
      spinner.stop();
      await updateWrappedOrgKey(orgId, keyRecord.wrappedOrgKey);
      output.success("Device approved!");
      return await cryptoUnwrapOrgKey(
        keyRecord.wrappedOrgKey,
        stored.privateKey,
      );
    }

    if (keyRecord?.status === "revoked") {
      spinner.stop();
      throw new Error("Device key was revoked. Re-run `beakcrypt login`.");
    }
  }

  spinner.fail("Timed out waiting for device approval (1 minute).");
  throw new Error(
    "Device approval timed out. Ask an admin to approve your device, then re-run the command.",
  );
}
