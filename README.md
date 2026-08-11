# llmpkg

**Keep reusable AI assets in repositories and use them across projects without copying files by hand.**

AI projects quickly accumulate skills, prompts, agent instructions, rules, workflows, templates, schemas, knowledge, and documentation. When those assets are copied between projects, versions drift and it becomes difficult to know which copy is authoritative.

`llmpkg` provides a small, open, repository-based distribution layer for those assets. A repository can be public, private, company-hosted, or entirely local. You keep ownership of the files and choose where they live; consumers can discover, inspect, install, list, and uninstall packages through one CLI.

This project is **not an agent framework** and **not a closed marketplace**. It does not prescribe a model provider, agent runtime, or application framework. Its purpose is narrower: organize, distribute, and reuse versioned resources for LLMs and agents on your own terms.

> **Project status:** `llmpkg` is currently a private, development-stage package in this repository. Build and link the CLI locally; it is not configured here as a published npm package. The current package schema is `llmpkg/v1`.

## What it can do

- Use HTTP/HTTPS, GitHub, generic Git (including SSH), or local filesystem repositories.
- Search repository indexes and inspect package manifests before installation.
- Install versioned packages with exact, caret (`^`), or tilde (`~`) constraints.
- Verify an artifact's SHA-256 integrity when its manifest provides an integrity hash.
- Preview artifact writes with `--dry-run`; the current implementation still records the installation in `.llmpkg/installed.json`.
- Track installed files in `.llmpkg/installed.json`, so uninstall removes only recorded package files.
- Maintain project-local and user-global repository configuration.
- Produce human-readable output or structured JSON with `--json` on operational commands.
- Store private-repository passwords encrypted with AES-256-GCM and keep credentials out of command output.

Supported package artifacts include skills, prompts, system prompts, agent instructions, rules, workflows, templates, schemas, knowledge, and documentation. See the [domain model](./docs/domain/domain-model.md) for manifest and validation details.

## Quick start from source

Requirements:

- Node.js 18 or newer
- pnpm
- `git` in `PATH` when using generic Git repositories
- an SSH client and an accepted host key when using SSH repositories

This repository tracks `pnpm-lock.yaml`, so pnpm is the canonical package manager for reproducible development installs and project scripts.

```bash
pnpm install --frozen-lockfile
pnpm test
pnpm run build
cd dist/cli
npm link
llmpkg help
```

The build creates a standalone CLI package in `dist/cli`. `npm link` exposes its `llmpkg` command in your current Node.js environment.

## Basic usage

Add a public repository globally, then discover and inspect packages:

```bash
llmpkg repo add community https://packages.example.org --global
llmpkg repo list
llmpkg search postgres
llmpkg info postgres-expert@^1.4
```

Install a package, preview its artifact writes, and inspect local installation state:

```bash
llmpkg install postgres-expert@^1.4 --target ./skills
llmpkg install postgres-expert@1.4.2 --target ./skills --dry-run
llmpkg list
llmpkg uninstall postgres-expert
```

`--dry-run` does not write artifact files, but it currently does persist an installation record in `.llmpkg/installed.json`.

## Preparing a local repository

Add a local repository for the current project:

```bash
llmpkg repo add local file:///absolute/path/to/skills-hub/
```

To prepare a local repository for more complex project needs, you can host multiple packages, and each package can consist of various artifact layers. Create a directory structure with a `registry.json` index and a `packages/` directory for your assets. Here is an example based on a real `skills-hub`:

```text
skills-hub/
  registry.json
  packages/
    documentation-standard/
      1.0.0/
        manifest.json
        SKILL.md
        resources/
          front-matter-schema.md
          hub-template.md
          ...
    layered-architecture/
      1.0.0/
        manifest.json
        SKILL.md
        resources/
          adapter-layer.md
          antipatterns.md
          ...
```

The `registry.json` indexes all your local packages for discovery:

```json
{
  "packages": [
    {
      "name": "documentation-standard",
      "latestVersion": "1.0.0",
      "versions": [
        "1.0.0"
      ],
      "description": "Standard tworzenia dokumentacji dla agentów"
    },
    {
      "name": "layered-architecture",
      "latestVersion": "1.0.0",
      "versions": [
        "1.0.0"
      ],
      "description": "Standard tworzenia architektury dla agentów"
    }
  ]
}
```

The `manifest.json` defines the package and all its artifacts, with paths relative to the `packages/` directory. For example, `packages/layered-architecture/1.0.0/manifest.json` demonstrates a package built from several layers:

```json
{
  "schema": "llmpkg/v1",
  "name": "layered-architecture",
  "version": "1.0.0",
  "description": "Standard tworzenia architektury dla agentów",
  "artifacts": [
    {
      "type": "skill",
      "id": "SKILL-md",
      "path": "layered-architecture/1.0.0/SKILL.md"
    },
    {
      "type": "layer",
      "id": "resources-adapter-layer-md",
      "path": "layered-architecture/1.0.0/resources/adapter-layer.md"
    }
  ],
  "dependencies": {}
}
```

> **Tip:** You can use the provided `./generate-manifest.sh <input_directory> <output_manifest>` script to automatically scaffold a `manifest.json` for your local package directory.

Since the repository structure is identical across all transports, you can easily share your local repository by turning it into a Git repository and pushing it to a server like GitHub:

```bash
cd skills-hub/
git init
git add .
git commit -m "Initial commit of AI assets"
git branch -M main
git remote add origin https://github.com/your-username/skills-hub.git
git push -u origin main
```

Generic Git URLs accept `ssh://`, `git://`, SCP-like `user@host:path` syntax, and URLs ending in `.git`. GitHub repositories also have a short form:

```bash
llmpkg repo add team ssh://git@example.com/team/ai-assets.git --global
llmpkg repo add public-tools github:owner/repository --global
```

Add `--json` to `search`, `info`, `install`, `uninstall`, `list`, `repo add`, or `repo list` when integrating the CLI with scripts.

The complete command behavior and examples live in the [CLI documentation](./docs/cli/README.md).

## Repositories and configuration

Without `--global`, `repo add` writes project configuration to:

```text
./.llmpkg/llmpkg.json
```

With `--global`, it writes user configuration to:

```text
~/.config/llmpkg/config.json
```

Project configuration takes precedence over global configuration. The selected repository is the one requested by the command when supported, otherwise the first repository in the resolved configuration.

Private repositories can receive credentials through `--username` and `--password`:

```bash
llmpkg repo add private ssh://git@example.com/team/private-assets.git \
  --username git \
  --password "your-password" \
  --global
```

Passwords are encrypted at rest with AES-256-GCM. The user-specific key is stored separately at `~/.config/llmpkg/credentials.key`, while usernames remain in configuration. Credentials and encrypted values are omitted from CLI output. Prefer SSH keys for automation, avoid committing `.llmpkg/llmpkg.json` when it describes private access, and protect the credential key: losing it makes encrypted passwords unrecoverable.

For protocol formats, credential handling, filesystem permissions, and transport constraints, read [Repository access](./docs/modules/repositories/repository-access.md).

## Architecture

`llmpkg` uses layered boundaries so package rules remain independent of the CLI and infrastructure:

```text
CLI input/output
      |
Application use cases
      |
Domain model and contracts
      ^
Infrastructure adapters (HTTP, Git, filesystem, configuration)
```

- The domain owns manifests, versions, integrity rules, dependency graphs, install plans, and contracts.
- Application use cases orchestrate search, information lookup, resolution, installation, uninstall, listing, and repository configuration.
- Infrastructure implements repository transports, filesystem access, installed-package storage, and configuration persistence.
- The CLI parses commands, wires dependencies, and formats text or JSON output.

## Current limitations

- Only the `llmpkg/v1` manifest schema is accepted.
- Dependency resolution currently checks direct dependencies only. Dependency artifacts are not installed automatically.
- Integrity verification runs only when an artifact declares an expected hash.
- `--dry-run` suppresses artifact file writes but still updates the installed-package record.
- The GitHub transport reads the `main` branch through `raw.githubusercontent.com`; use generic Git when you need the server's default branch or authenticated Git behavior.
- Generic Git operations require system `git`; SSH connectivity and host-key setup remain the user's responsibility.
- The optional local cache exists as infrastructure but is not wired into the current CLI flow.

## Documentation

Start with the [documentation index](./docs/INDEX.md) or browse by responsibility:

- [Repositories module](./docs/modules/repositories/README.md) — repository configuration, access, authentication, and supported transports
- [CLI](./docs/cli/README.md) — commands, output modes, local build, and usage examples
- [Domain](./docs/domain/README.md) — package model, manifests, versions, integrity, dependency rules, and contracts
- [Application](./docs/application/README.md) — use cases and data flow
- [Infrastructure](./docs/infrastructure/README.md) — transport, filesystem, store, cache, and configuration adapters
- [Documentation by architectural layer](./docs/by-layer.md) — cross-cutting navigation through the layered design

The root README is intentionally an overview. The linked documents are the canonical references for detailed behavior and architectural decisions.
