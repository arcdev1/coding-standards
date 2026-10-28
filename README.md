# coding-standards

Single source of truth for the Arcnovus coding standard.

The standard has two layers. [`standard/core.md`](standard/core.md) holds the rules
every stack follows. Each file in [`standard/profiles/`](standard/profiles) holds the
mechanics for one stack, filling the core's `<!-- profile: ID -->` slots with
`<!-- slot: ID -->` blocks under the same section numbers:

| Profile          | Stack                                                                   |
| ---------------- | ----------------------------------------------------------------------- |
| `tanstack-start` | Full-stack React on TanStack Start, Drizzle, Better Auth, playwright-bdd |
| `capacitor-pwa`  | Offline-first Vite SPA, installable PWA, Capacitor shells, Dexie         |
| `kotlin-spring`  | Kotlin JVM service on Spring Boot                                        |
| `python-fastapi` | Python HTTP backend on FastAPI and PostgreSQL                            |
| `rust-cli`       | Rust command-line tool                                                   |

Projects that follow the standard carry a **generated, vendored** copy of it at their
own root (machine-synced from here, never hand-edited), assembled from the core plus
the profiles that project uses. A banner at the top of each vendored copy says so, and
a `standards:check` script fails CI if one is edited by hand.

[`CODING_STANDARDS.md`](CODING_STANDARDS.md) at this repo's root is build output: the
core plus the `tanstack-start` profile, rebuilt by `scripts/build.mjs`. Consumers on
the pre-profile runner still sync from it.

Why a vendored file rather than a submodule or an npm package: the two consumers of
this standard are humans reading it and coding agents (Claude Code and the like), and
agents read *local* files. A real file in each repo keeps the standard offline,
self-contained, and records in that repo's git history exactly which version it was
built against.

## Using the standard in your project

Vendor these things into your repo once:

1. Copy [`scripts/standards-sync.mjs`](scripts/standards-sync.mjs) into your repo
   (e.g. `scripts/standards-sync.mjs`).
2. Add two scripts to your `package.json`, or the equivalent commands to your task
   runner (the runner needs only Node 18+):

   ```json
   "standards:sync": "node scripts/standards-sync.mjs",
   "standards:check": "node scripts/standards-sync.mjs --check"
   ```

3. Name your profiles in a `.standards.json` next to where the vendored file goes.
   Without one, the runner uses `tanstack-start`:

   ```json
   {
     "profiles": [{ "name": "python-fastapi", "scope": "backend/" }],
     "local": [{ "path": "docs/standards/frontend.md", "scope": "frontend/" }]
   }
   ```

   A **local profile** is a file in your repo, written in the same slot format, for
   rules only your project has. When more than one profile fills a section, the
   vendored copy labels each block with its profile's title and scope.

4. Add the generated artifacts to `.prettierignore` (and any other formatter) so a
   `format` run never rewrites them:

   ```
   CODING_STANDARDS.md
   .standards-version
   scripts/standards-sync.mjs
   ```

Then run `pnpm standards:sync` (or `node scripts/standards-sync.mjs`). It writes
`CODING_STANDARDS.md` (a generated banner + the assembled body) and a sibling
`.standards-version` next to wherever it runs. Commit both.

- **`standards:sync`** fetches the core, your profiles and `VERSION` at the canonical
  `main` HEAD, pins the newest commit that touched any of them, and rewrites the
  vendored copy only if that SHA differs from `.standards-version`, the file was
  hand-edited, or a local profile changed. The banner carries the version and short
  SHA but **no timestamp**, so identical inputs produce identical bytes and re-syncs
  never create false diffs. The volatile `syncedAt` lives only in
  `.standards-version`.
- **`standards:check`** (network-free, for CI) recomputes the hash of the vendored
  body and of each local profile, and fails if the file was hand-edited or a local
  profile changed without a re-sync.

The runner needs **no dependencies** and **no auth**: it uses the `gh` CLI when one is
installed and authenticated (higher rate limit), and otherwise falls back to plain
unauthenticated HTTPS against this public repo, so any Node 18+ environment can sync
it, whether or not it has a GitHub token.

To place the vendored file somewhere other than the current directory (e.g. a monorepo
sub-app), run the script from that directory, or pass `--dest <path>` /
`STANDARDS_DEST=<path>`. To rehearse an unmerged change, pass `--source <path>` with a
local checkout of this repo.

## Changing the standard

1. On a branch, edit [`standard/core.md`](standard/core.md) for a rule every stack
   follows, or a file in [`standard/profiles/`](standard/profiles) for one stack.
2. Run `node scripts/build.mjs` to rebuild the root `CODING_STANDARDS.md`. CI runs
   `node scripts/build.mjs --check`, which fails when the root file is stale or a
   profile fills a slot the core doesn't have.
3. Bump [`VERSION`](VERSION) (semver — see [`CHANGELOG.md`](CHANGELOG.md) for what
   MAJOR/MINOR/PATCH mean) and add a `CHANGELOG.md` entry.
4. Open a PR and merge it.
5. Tag the merge commit `v<VERSION>` and push the tag.

Consumers pick the change up on their next `standards:sync`. A profile change reaches
only the projects that use that profile.

## Files

```
standard/core.md           the rules every stack follows
standard/profiles/*.md     one file per stack, filling the core's slots
CODING_STANDARDS.md        build output: core + tanstack-start
VERSION                    semver, bumped on every content change
CHANGELOG.md               one entry per version
scripts/standards-sync.mjs the vendored, self-contained sync/check runner
scripts/build.mjs          rebuilds CODING_STANDARDS.md; --check for CI
```
