# beakcrypt

Secure environment variable management with end-to-end encryption. Secrets are encrypted on your machine before leaving it — beakcrypt never sees plaintext values.

## Installation

```bash
npm install -g beakcrypt
```

Requires Node.js 20 or later.

## Quick start

```bash
# Log in with GitHub
beakcrypt login

# Link your project directory
beakcrypt link

# Push your local .env.local to the cloud
beakcrypt push

# Pull secrets back down on another machine
beakcrypt pull
```

## Commands

### Auth

```
beakcrypt login           Log in via GitHub OAuth
beakcrypt logout          Log out and remove local credentials
beakcrypt whoami          Show the currently logged-in user
```

### Project linking

```
beakcrypt link            Link the current directory to a project
```

### Secrets sync

```
beakcrypt pull [file]     Pull secrets to a local .env file (default: .env.local)
beakcrypt push [file]     Push secrets from a local .env file (default: .env.local)
beakcrypt run -- <cmd>    Run a command with secrets injected as environment variables
```

All sync commands accept these flags:

```
-o, --org <slug>          Organization slug
-p, --project <name>      Project name
-e, --env <name>          Environment name
-y, --yes                 Skip confirmation prompts (push, logout)
```

`pull` also accepts:

```
--output <path>           Output file path including filename
                          (overrides the positional [file] argument)
```

The destination can be specified as a positional argument or via `--output`. Both accept any path including the filename:

```bash
beakcrypt pull secrets/.env.development
beakcrypt pull --output /home/user/projects/app/.env.local
beakcrypt pull --output ../shared/.env -e staging
```

### Secrets management

```
beakcrypt secrets list                  List secrets (values masked by default)
beakcrypt secrets list --reveal         Decrypt and print plaintext values
beakcrypt secrets set <KEY=VALUE...>    Set one or more secrets
beakcrypt secrets remove <KEY...>       Remove secrets by key
beakcrypt secrets clear                 Delete all secrets in an environment
```

All `secrets` subcommands accept `-o`, `-p`, `-e` flags.

### Organizations

```
beakcrypt org list                      List your organizations
```

### Environments

```
beakcrypt env list                      List environments for the linked project
beakcrypt env create <name>             Create a new environment
beakcrypt env remove <name>             Delete an environment and all its secrets
```

All `env` subcommands accept `-o, --org <slug>` and `-p, --project <name>` flags.  
`env remove` also accepts `-y, --yes` to skip the confirmation prompt.

### Projects

```
beakcrypt project list                  List projects in an organization
beakcrypt project create <name>         Create a new project
beakcrypt project remove <name>         Delete a project and all its data
```

All `project` subcommands require `-o, --org <slug>`.  
`project remove` also accepts `-y, --yes` to skip the confirmation prompt.

## Examples

```bash
# Inject secrets into a dev server
beakcrypt run -- npm run dev

# Push a specific env file to a named environment
beakcrypt push .env.production -e production

# Set individual secrets directly
beakcrypt secrets set API_KEY=abc123 DATABASE_URL=postgres://...

# Pull into a custom file path (positional)
beakcrypt pull .env.staging -e staging

# Pull into a specific directory and filename (flag)
beakcrypt pull --output config/.env.local

# Pull staging secrets into a sibling directory
beakcrypt pull --output ../frontend/.env -e staging

# Reveal decrypted values in the terminal
beakcrypt secrets list --reveal

# Create a staging environment in a specific project
beakcrypt env create staging --org acme --project api

# Remove an environment (prompts for confirmation)
beakcrypt env remove preview --org acme --project api

# List all projects in an org
beakcrypt project list --org acme

# Create a new project
beakcrypt project create payments --org acme

# Delete a project without confirmation prompt
beakcrypt project remove old-service --org acme --yes
```
