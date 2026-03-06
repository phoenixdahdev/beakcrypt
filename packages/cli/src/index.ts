import { Command } from "commander";
import { handleError } from "./lib/errors";
import { loginCommand } from "./commands/login";
import { logoutCommand } from "./commands/logout";
import { whoamiCommand } from "./commands/whoami";
import { linkCommand } from "./commands/link";
import { pullCommand } from "./commands/pull";
import { pushCommand } from "./commands/push";
import { runCommand } from "./commands/run";
import { secretsListCommand } from "./commands/secrets/list";
import { secretsSetCommand } from "./commands/secrets/set";
import { secretsRemoveCommand } from "./commands/secrets/remove";
import { secretsClearCommand } from "./commands/secrets/clear";
import { orgListCommand } from "./commands/org/list";
import { envListCommand } from "./commands/env/list";
import { envCreateCommand } from "./commands/env/create";
import { envRemoveCommand } from "./commands/env/remove";
import { projectListCommand } from "./commands/project/list";
import { projectCreateCommand } from "./commands/project/create";
import { projectRemoveCommand } from "./commands/project/remove";
import { interactiveMode } from "./interactive-mode";

const program = new Command();

program
  .name("beakcrypt")
  .description("Secure environment variable management with E2E encryption")
  .version("0.1.0")
  .action(async () => {
    try {
      await interactiveMode();
    } catch (err) {
      handleError(err);
    }
  });

// Auth commands
program
  .command("login")
  .description("Log in to Beakcrypt via GitHub OAuth")
  .action(async () => {
    try {
      await loginCommand();
    } catch (err) {
      handleError(err);
    }
  });

program
  .command("logout")
  .description("Log out and remove all credentials")
  .option("-y, --yes", "Skip confirmation prompt")
  .action(async (opts) => {
    try {
      await logoutCommand(opts);
    } catch (err) {
      handleError(err);
    }
  });

program
  .command("whoami")
  .description("Show current user info")
  .action(async () => {
    try {
      await whoamiCommand();
    } catch (err) {
      handleError(err);
    }
  });

// Project linking
program
  .command("link")
  .description("Link this directory to a Beakcrypt project")
  .action(async () => {
    try {
      await linkCommand();
    } catch (err) {
      handleError(err);
    }
  });

// Secret sync commands
program
  .command("pull [file]")
  .description("Pull secrets to a local .env file (default: .env.local)")
  .option("-o, --org <slug>", "Organization slug")
  .option("-p, --project <name>", "Project name")
  .option("-e, --env <name>", "Environment name")
  .option(
    "--output <path>",
    "Output file path including filename (overrides positional argument)",
  )
  .action(async (file, opts) => {
    try {
      await pullCommand(file, opts);
    } catch (err) {
      handleError(err);
    }
  });

program
  .command("push [file]")
  .description("Push secrets from a local .env file")
  .option("-o, --org <slug>", "Organization slug")
  .option("-p, --project <name>", "Project name")
  .option("-e, --env <name>", "Environment name")
  .option("-y, --yes", "Skip confirmation prompt")
  .action(async (file, opts) => {
    try {
      await pushCommand(file, opts);
    } catch (err) {
      handleError(err);
    }
  });

program
  .command("run")
  .description("Run a command with injected secrets")
  .option("-o, --org <slug>", "Organization slug")
  .option("-p, --project <name>", "Project name")
  .option("-e, --env <name>", "Environment name")
  .allowUnknownOption()
  .action(async (opts, cmd) => {
    try {
      await runCommand(cmd.args, opts);
    } catch (err) {
      handleError(err);
    }
  });

// Secrets subcommands
const secrets = program.command("secrets").description("Manage secrets");

secrets
  .command("list")
  .description("List secrets (values masked by default)")
  .option("-o, --org <slug>", "Organization slug")
  .option("-p, --project <name>", "Project name")
  .option("-e, --env <name>", "Environment name")
  .option("--reveal", "Decrypt and print plaintext values")
  .action(async (opts) => {
    try {
      await secretsListCommand(opts);
    } catch (err) {
      handleError(err);
    }
  });

secrets
  .command("set <pairs...>")
  .description("Set secrets (KEY=VALUE)")
  .option("-o, --org <slug>", "Organization slug")
  .option("-p, --project <name>", "Project name")
  .option("-e, --env <name>", "Environment name")
  .action(async (pairs, opts) => {
    try {
      await secretsSetCommand(pairs, opts);
    } catch (err) {
      handleError(err);
    }
  });

secrets
  .command("remove <keys...>")
  .description("Remove secrets by key")
  .option("-o, --org <slug>", "Organization slug")
  .option("-p, --project <name>", "Project name")
  .option("-e, --env <name>", "Environment name")
  .action(async (keys, opts) => {
    try {
      await secretsRemoveCommand(keys, opts);
    } catch (err) {
      handleError(err);
    }
  });

secrets
  .command("clear")
  .description("Delete all secrets in an environment")
  .option("-o, --org <slug>", "Organization slug")
  .option("-p, --project <name>", "Project name")
  .option("-e, --env <name>", "Environment name")
  .option("-y, --yes", "Skip confirmation prompt")
  .action(async (opts) => {
    try {
      await secretsClearCommand(opts);
    } catch (err) {
      handleError(err);
    }
  });

// Org subcommands
const org = program.command("org").description("Manage organizations");

org
  .command("list")
  .description("List your organizations")
  .action(async () => {
    try {
      await orgListCommand();
    } catch (err) {
      handleError(err);
    }
  });

// Env subcommands
const env = program.command("env").description("Manage environments");

env
  .command("list")
  .description("List environments for the linked project")
  .option("-o, --org <slug>", "Organization slug")
  .option("-p, --project <name>", "Project name")
  .action(async (opts) => {
    try {
      await envListCommand(opts);
    } catch (err) {
      handleError(err);
    }
  });

env
  .command("create <name>")
  .description("Create a new environment in the linked project")
  .option("-o, --org <slug>", "Organization slug")
  .option("-p, --project <name>", "Project name")
  .action(async (name, opts) => {
    try {
      await envCreateCommand(name, opts);
    } catch (err) {
      handleError(err);
    }
  });

env
  .command("remove <name>")
  .description("Delete an environment and all its secrets")
  .option("-o, --org <slug>", "Organization slug")
  .option("-p, --project <name>", "Project name")
  .option("-y, --yes", "Skip confirmation prompt")
  .action(async (name, opts) => {
    try {
      await envRemoveCommand(name, opts);
    } catch (err) {
      handleError(err);
    }
  });

// Project subcommands
const project = program.command("project").description("Manage projects");

project
  .command("list")
  .description("List projects in an organization")
  .option("-o, --org <slug>", "Organization slug (required)")
  .action(async (opts) => {
    try {
      await projectListCommand(opts);
    } catch (err) {
      handleError(err);
    }
  });

project
  .command("create <name>")
  .description("Create a new project in an organization")
  .option("-o, --org <slug>", "Organization slug (required)")
  .action(async (name, opts) => {
    try {
      await projectCreateCommand(name, opts);
    } catch (err) {
      handleError(err);
    }
  });

project
  .command("remove <name>")
  .description("Delete a project and all its environments and secrets")
  .option("-o, --org <slug>", "Organization slug (required)")
  .option("-y, --yes", "Skip confirmation prompt")
  .action(async (name, opts) => {
    try {
      await projectRemoveCommand(name, opts);
    } catch (err) {
      handleError(err);
    }
  });

program.parse();
