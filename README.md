<div align="center">
  <img src=".github/assets/logo.svg" alt="Beakcrypt" width="72" />
  <h1>Beakcrypt</h1>
  <p><strong>The open-source standard for managing and sharing environment variables securely across your entire development workflow.</strong></p>
  <p>
    <a href="https://beakcrypt.com">🌐 beakcrypt.com</a>
    &nbsp;·&nbsp;
    <a href="https://github.com/prudentbird/beakcrypt/issues/new?template=bug_report.md">🐛 Report a Bug</a>
    &nbsp;·&nbsp;
    <a href="https://github.com/prudentbird/beakcrypt/issues/new?template=feature_request.md">✨ Request a Feature</a>
  </p>
  <br />

  <!-- Tech Stack -->
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=next.js&logoColor=white" alt="Next.js" />
  <img src="https://img.shields.io/badge/Convex-EE342F?style=for-the-badge&logo=convex&logoColor=white" alt="Convex" />
  <img src="https://img.shields.io/badge/Better_Auth-6366F1?style=for-the-badge&logoColor=white" alt="Better Auth" />
  <img src="https://img.shields.io/badge/Turborepo-EF4444?style=for-the-badge&logo=turborepo&logoColor=white" alt="Turborepo" />
  <img src="https://img.shields.io/badge/pnpm-F69220?style=for-the-badge&logo=pnpm&logoColor=white" alt="pnpm" />
  <br /><br />

  <!-- Repo Stats -->

<a href="https://github.com/prudentbird/beakcrypt/stargazers"><img src="https://img.shields.io/github/stars/prudentbird/beakcrypt?style=for-the-badge&logo=github&color=FFD700&labelColor=1a1a2e" alt="Stars" /></a>
<a href="https://github.com/prudentbird/beakcrypt/network/members"><img src="https://img.shields.io/github/forks/prudentbird/beakcrypt?style=for-the-badge&logo=github&color=4A90E2&labelColor=1a1a2e" alt="Forks" /></a>
<a href="https://github.com/prudentbird/beakcrypt/issues"><img src="https://img.shields.io/github/issues/prudentbird/beakcrypt?style=for-the-badge&logo=github&color=E74C3C&labelColor=1a1a2e" alt="Issues" /></a>
<a href="https://github.com/prudentbird/beakcrypt/blob/dev/LICENSE"><img src="https://img.shields.io/github/license/prudentbird/beakcrypt?style=for-the-badge&color=22c55e&labelColor=1a1a2e" alt="License" /></a>

</div>

---

## Table of Contents

- [What is Beakcrypt?](#what-is-beakcrypt)
- [Using Beakcrypt](#using-beakcrypt)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Contributing](#contributing)
- [License](#license)

---

## What is Beakcrypt?

Tired of pasting `.env` files into Slack? Sending secrets over email? Beakcrypt gives your team a **shared, end-to-end encrypted vault** for environment variables — managed with a CLI that fits into the workflow you already use.

- 🔒 **End-to-end encrypted** — secrets are encrypted on your machine before they ever leave it
- 🤝 **Team vaults** — invite teammates and manage access per project
- ⚡ **CLI-first** — push and pull `.env` files in seconds
- 🌍 **Fully open-source** — audit every line, self-host if you want, contribute freely

---

## Using Beakcrypt

> 📹 **Demo video coming soon.**

```bash
# Log in with GitHub OAuth
$ beakcrypt login
✓ Logged in as jane@acme.com

# Link this directory to a project
$ beakcrypt link
✓ Linked to acme/api (development)

# Push your local secrets — encrypted before upload
$ beakcrypt push
→ Encrypting 12 variables...
✓ Synced to vault

# A teammate pulls the secrets on their machine
$ beakcrypt pull
→ Fetching from vault...
✓ Written to .env.local

# Inject secrets directly into any command
$ beakcrypt run -- npm run dev
```

No more `.env` files in Slack. No more "which version of the key is correct?". **One vault. One source of truth.**

---

## Project Structure

This is a **Turborepo monorepo** managed with `pnpm` workspaces.

```
beakcrypt/
├── apps/
│   ├── web/              # Next.js app — beakcrypt.com
│   └── docs/             # Documentation site (Fumadocs)
├── packages/
│   ├── cli/              # CLI tool — published as `beakcrypt` on npm
│   ├── convex/           # Convex backend — schema, auth, API
│   ├── crypto/           # Shared E2EE primitives (RSA-4096, AES-256-GCM)
│   ├── shared/           # Shared types and utilities
│   ├── ui/               # Shared UI component library
│   ├── transactional/    # Transactional email templates
│   ├── eslint-config/    # Shared ESLint configuration
│   └── typescript-config/ # Shared TypeScript configuration
├── turbo.json
├── pnpm-workspace.yaml
└── tsconfig.json
```

---

## Getting Started

### Prerequisites

| Tool        | Version        | Install                                                      |
| ----------- | -------------- | ------------------------------------------------------------ |
| **Node.js** | `v18` or later | [nodejs.org](https://nodejs.org/)                            |
| **pnpm**    | `v10` or later | `corepack enable && corepack prepare pnpm@latest --activate` |
| **Git**     | latest         | [git-scm.com](https://git-scm.com/)                          |

> **Note:** pnpm is the only tool you need globally. Convex CLI is run via `npx` (no global install needed). If you already have pnpm installed via `npm i -g pnpm`, that works too.

Verify your setup:

```bash
node --version    # v18+
pnpm --version    # v10+
git --version
```

> **Just want to run it locally?** Clone directly.
> **Want to contribute back?** Fork first, then clone your fork — see [Contributing](#contributing).

### 1. Clone the repository

```bash
git clone https://github.com/prudentbird/beakcrypt.git
cd beakcrypt
git checkout dev
```

### 2. Install dependencies

```bash
pnpm install
```

### 3. Set up environment variables

```bash
cp apps/web/.env.example apps/web/.env.local
```

Open `apps/web/.env.local` and fill in the required values. Every variable is documented inside the file. The two services you must configure:

**Convex** — run `npx convex dev` from the repo root. It will walk you through creating a free deployment and automatically print your `CONVEX_DEPLOYMENT`, `CONVEX_URL`, and `CONVEX_SITE_URL` values.

**GitHub OAuth** — create a free OAuth App at [github.com/settings/developers](https://github.com/settings/developers):

- **Homepage URL:** `http://localhost:3000`
- **Callback URL:** `http://localhost:3000/api/auth/callback/github`

**Better Auth** — generate a secret:

```bash
openssl rand -base64 32
```

### 4. Run in development

```bash
pnpm dev
```

The web app will be available at **`http://localhost:3000`** and the docs at **`http://localhost:3000/docs`**.

> **Note:** `pnpm dev` starts all apps using Turborepo with Vercel Microfrontends. If you only want to run the web app locally, use:
>
> ```bash
> cd apps/web && npx next dev --port 3000 --turbopack
> ```

> **Tip:** If you want to start the server before configuring Convex (e.g. to explore the codebase), set `SKIP_ENV_VALIDATION=1`:
>
> ```bash
> SKIP_ENV_VALIDATION=1 pnpm dev
> ```

### Other commands

```bash
pnpm build          # Build all apps and packages
pnpm lint           # Run ESLint across the monorepo
pnpm typecheck      # TypeScript type checking
pnpm format         # Format code with Prettier
pnpm dev:app        # Run only the web app + Convex backend
```

---

## Contributing

Contributions are welcome — bug fixes, features, and docs all count. Please read **[CONTRIBUTING.md](./CONTRIBUTING.md)** before opening a PR.

**Quick contribution flow:**

```bash
# 1. Fork the repo and clone your fork
git clone https://github.com/<your-username>/beakcrypt.git
cd beakcrypt
git remote add upstream https://github.com/prudentbird/beakcrypt.git

# 2. Create a feature branch off dev
git fetch upstream
git checkout -b feat/your-feature upstream/dev

# 3. Make your changes, then push
git push origin feat/your-feature

# 4. Open a Pull Request against the dev branch
```

**Ready to jump in?**

- 🐛 [Open a bug report](https://github.com/prudentbird/beakcrypt/issues/new?template=bug_report.md)
- ✨ [Request a feature](https://github.com/prudentbird/beakcrypt/issues/new?template=feature_request.md)
- 🔀 [Submit a pull request](https://github.com/prudentbird/beakcrypt/compare) — see our [PR template](./.github/pull_request_template.md)
- 🏷️ [`good first issue`](https://github.com/prudentbird/beakcrypt/issues?q=is%3Aopen+is%3Aissue+label%3A%22good+first+issue%22) — great for first-time contributors

---

## License

Distributed under the **MIT License** — see [`LICENSE`](./LICENSE) for details.

---

<div align="center">
  <p>If you find Beakcrypt useful, please consider giving it a ⭐</p>
  <p>Made with ❤️ by <a href="https://prudentbird.com">prudentbird</a> and contributors</p>
</div>
