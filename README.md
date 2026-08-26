# coding-standards

Single source of truth for the Arcnovus **TanStack Start** coding standard.

[`CODING_STANDARDS.md`](CODING_STANDARDS.md) is the only hand-edited copy. Projects
that follow the standard carry a **generated, vendored** copy of it at their own repo
root (machine-synced from here — never hand-edited). A banner at the top of each
vendored copy says so, and a `standards:check` script fails CI if one is edited by hand.

Why a vendored file rather than a submodule or an npm package: the two consumers of
this standard are humans reading it and coding agents (Claude Code and the like), and
agents read *local* files. A real file in each repo keeps the standard offline,
self-contained, and records in that repo's git history exactly which version it was
built against.

## Using the standard in your project

Vendor these two things into your repo once:

1. Copy [`scripts/standards-sync.mjs`](scripts/standards-sync.mjs) into your repo
   (e.g. `scripts/standards-sync.mjs`).
2. Add two scripts to your `package.json`:

   ```json
   "standards:sync": "node scripts/standards-sync.mjs",
   "standards:check": "node scripts/standards-sync.mjs --check"
   ```

3. Add the generated artifacts to `.prettierignore` (and any other formatter) so a
   `format` run never rewrites them:

   ```
   CODING_STANDARDS.md
   .standards-version
   scripts/standards-sync.mjs
   ```

Then run `pnpm standards:sync` (or `node scripts/standards-sync.mjs`). It writes
`CODING_STANDARDS.md` (a generated banner + the canonical body) and a sibling
`.standards-version` next to wherever it runs. Commit both.

- **`standards:sync`** fetches the canonical body, `VERSION`, and the commit SHA of
  `CODING_STANDARDS.md`, and — only if the SHA differs from the local
  `.standards-version` (or the file was hand-edited) — rewrites the vendored copy. The
  banner carries the version + short SHA but **no timestamp**, so identical inputs
  produce identical bytes and re-syncs never create false diffs. The volatile
  `syncedAt` lives only in `.standards-version`.
- **`standards:check`** (network-free, for CI) recomputes the hash of the local body
  and compares it to `.standards-version.bodyHash`, failing if the file was hand-edited.

The runner needs **no dependencies** and **no auth**: it uses the `gh` CLI when one is
installed and authenticated (higher rate limit), and otherwise falls back to plain
unauthenticated HTTPS against this public repo — so any Node 18+ environment can sync
it, whether or not it has a GitHub token.

To place the vendored file somewhere other than the current directory (e.g. a monorepo
sub-app), run the script from that directory, or pass `--dest <path>` /
`STANDARDS_DEST=<path>`.

## Changing the standard

1. Edit [`CODING_STANDARDS.md`](CODING_STANDARDS.md) on a branch.
2. Bump [`VERSION`](VERSION) (semver — see [`CHANGELOG.md`](CHANGELOG.md) for what
   MAJOR/MINOR/PATCH mean) and add a `CHANGELOG.md` entry.
3. Open a PR and merge it.
4. Tag the merge commit `v<VERSION>` and push the tag.

Consumers pick the change up on their next `standards:sync`.

## Files

```
CODING_STANDARDS.md        the standard — the only hand-edited copy
VERSION                    semver, bumped on every content change
CHANGELOG.md               one entry per version
scripts/standards-sync.mjs the vendored, self-contained sync/check runner
```
