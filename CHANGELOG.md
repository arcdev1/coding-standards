# Changelog

All notable changes to the Arcnovus TanStack Start coding standard.

Versioning: `MAJOR.MINOR.PATCH` in [`VERSION`](VERSION), bumped on every content
change, with the commit tagged `v<version>`. `MAJOR` = a rule changed or was removed
in a way that could fail existing code review; `MINOR` = a rule added; `PATCH` =
wording, examples, or typo fixes with no change in what passes.

## 2.1.2 — 2026-10-23

- Fixed the sync runner doing nothing when run through a symlinked path. The 2.1.0
  runner decided whether it was the main script by comparing `process.argv[1]` with
  `import.meta.url`, but node resolves symlinks for the main module, so a run from
  macOS's `/var/folders/…` temp directory (where the orchestrator builds sync
  commits) exited 0 without writing anything. The 2026-10-23 sync PRs carried only the
  new runner as a result. The check now compares real paths.
- Formatted `scripts/standards-sync.mjs` and `scripts/build.mjs` with the house Prettier
  settings, since some consumers format-check the vendored runner.
- PATCH: no rule changes.

## 2.1.1 — 2026-10-22

- Every assembled copy now opens with a generated **Contents** list linking each
  numbered section and its subsections, and "How to use this document" gains a table
  mapping each kind of change to the sections to read. Together they are the navigation
  pointers the `retro` skill asks for once a standards file passes 1,000 lines.
- "How this standard relates to a project's own docs" now says where a new rule goes: a
  rule only this project needs goes in its local profile, one every project needs goes
  upstream, and the generated copy is never edited. This gives `retro` and `correct`
  a target that `standards:check` accepts.
- Removed text the `tanstack-start` profile repeated from the core (§1, §5, §5.2, §7.2).
  `scripts/build.mjs` prints each profile's assembled length and warns above 1,000 lines.
- PATCH: wording and navigation only; nothing that passed review fails now.

## 2.1.0 — 2026-10-22

- Split the standard into a language-neutral **core** (`standard/core.md`) and **stack
  profiles** (`standard/profiles/`). Each profile fills the core's numbered slots, so a
  section number means the same thing on every stack. A consumer's vendored copy is
  assembled from the core plus the profiles it names in `.standards.json`, plus any
  repo-local profile for rules only that project has; with no config it gets
  `tanstack-start`. The root `CODING_STANDARDS.md` is now build output (core +
  `tanstack-start`, by `scripts/build.mjs`), and a CI check fails when it is stale or a
  profile fills a slot the core lacks. Reason: chaos and xcog had to fork the whole file
  to change their stack sections, so core rules such as §11.1 reached them only by hand.
- Five profiles: `tanstack-start` (2.0.0's stack rules, moved without change),
  `capacitor-pwa` (the offline-first client, distilled from chaos's fork),
  `kotlin-spring` (from 2257etc's `service/pdf`), `python-fastapi` (from xcog's backend)
  and `rust-cli` (from preview-rs).
- §11.1 now names the interface per kind of app: a web UI through playwright-bdd as
  before, a command-line tool by running its built binary, and a component with no UI of
  its own through its consuming app's scenarios.
- The TanStack checklist gains item 13 ("TanStack specifics?"), holding the stack details
  items 3, 7, 8 and 10 named before; the smell pass becomes item 14.
- Sync runner: `.standards.json` with scoped and local profiles, labelled blocks when
  several profiles fill one section, `--check` also catching an edited local profile,
  and `--source <dir>` to rehearse against a local checkout.
- MINOR: nothing that passed review on a TanStack app fails now; the new profiles add
  rules for stacks the standard didn't cover. Source: Bill, core-plus-profiles decision.

## 2.0.0 — 2026-10-22

- Added §11.1 "End-to-end coverage". Every user-observable behavior (a page or flow,
  a validation message, an error or empty state, a permission denial, a redirect, an
  email or file the app sends) is specified in a Gherkin `.feature` file and
  exercised through playwright-bdd. A change is complete only when its behavior is in
  a feature file and the full `test:e2e` suite passes: new features add scenarios,
  behavior changes edit them, user-facing bug fixes add a scenario that fails before
  the fix, removals delete them, and behavior-preserving refactors leave them alone.
  A tagged CI subset (`@smoke`) may gate the deploy, but the full suite runs before
  merge. A skipped scenario (`@skip`, `@fixme`, an undefined step) is not coverage.
  `@pending` is the one exception: it marks a scenario for behavior the app does not
  have yet, is excluded at generation (`tags: 'not @pending'`), counts as coverage
  for nothing, and comes off in the change that builds the behavior. No other tag may
  exclude a scenario from the full run.
  Steps are written in domain language at the level of user intent, with selectors
  in step definitions. Each distinct user-visible outcome gets a scenario, and the
  inputs behind one outcome stay in unit tests. Adds the `features/` layout and moves
  the serial-run and row-marker rules from the §11 bullet list into §11.1.
- §2's gate gains a fifth script, `test:e2e` (`bddgen && playwright test`): the first
  four still run on every commit, and `test:e2e` must pass before a change is
  complete. §12 makes the full `test:e2e` run a merge precondition. Added
  review-checklist item 12 ("Behavior covered end to end?") and renumbered the smell
  pass to 13.
- MAJOR: a change that passed review before fails now if its behavior has no passing
  scenario, and an app whose CI runs only a smoke subset must also run the full suite
  before merge. Source: Bill, E2E-as-definition-of-done decision.

## 1.7.0 — 2026-10-10

- Added §5.2 "Return values", the "return an object" half of RORO (§5.1 already
  carries "receive an object"). A function with more than one thing to report returns
  a named object, never a tuple. A function whose failure is an ordinary branch its
  direct caller handles (classifying a parse or match, per-item outcomes in batch
  work, a service call the caller recovers from) returns a `Result`: a plain
  `{ ok: true; value } | { ok: false; error: { code } }` union defined once in
  `src/lib/result.ts`, with no Result library. Everywhere else throws: a failure that
  ends the request is still an `AppError` (§9), a server function never returns a
  `Result` (TanStack Query would cache it as a success, and the error middleware would
  map no status), a transaction aborts by throwing (Drizzle commits work that returns
  instead of throwing), and data-access modules keep §7.2. §9 now scopes `AppError` to
  failures that end the request; §4's `src/lib/` row, and review-checklist items 8 and
  10, cover the additions. MINOR: a rule added. Source: Bill, RORO discussion.

## 1.6.0 — 2026-10-06

- Narrowed §12's human merge gate to production. Merging into the production-aligned
  branch of an externally deployed app (the branch whose every push deploys
  production: `prod` where `main` is the trunk, or the default branch where that
  branch deploys production) needs explicit approval naming that branch. Merges into
  non-production branches, in apps that run only locally, or that stay in a local
  checkout need none, and a merge request that names no branch means a
  non-production target. The history-rewrite rule now also covers the
  production-aligned branch. MINOR: nothing that passed review before fails now.
  Source: Bill, external-app branch model (arcdev1/chaos ADR-0038).

## 1.5.0 — 2026-09-14

- Extended "How this standard relates to a project's own docs" with the agent-facing
  records lifecycle. Conventions and code comments are current-state (edited in place,
  history in git; no "used to" comments). A superseded ADR is not rewritten: it keeps
  a machine-readable `status:` and a forward link, its body is distilled to the
  decision and the reasons that carry forward, and it moves to a status-gated path
  (`docs/adr/superseded/`) so it leaves the default grep and retrieval set. Reason:
  agent freshness rot, where a search ranks a superseded record as readily as its
  replacement. git is the recovery backstop, not the read path. Source: Bill,
  agent-facing-records decision.

## 1.4.0 — 2026-09-09

- Extended §7.4 "Migrations" with the schema-first authoring rule: migrations are
  generated from the Drizzle schema via `db:generate` and applied with `db:migrate`
  — the generated SQL and `meta/` snapshot are committed but treated as build output,
  never hand-edited (a hand-edit or loose migration file desyncs the snapshot Drizzle
  diffs against). Hand-written SQL is reserved for changes the schema DSL can't express
  (data backfills, `CONCURRENTLY` indexes, triggers) and must still go through a tracked
  `db:generate --custom` migration; a raw statement run straight against a database is
  off the table. Added review-checklist item 7 ("Migrations generated?") and renumbered
  the former items 7–11 to 8–12.

## 1.3.0 — 2026-09-09

- Extended §0 with the shadcn generator's operating rules: a committed
  `components.json` is required (with its canonical shape and a `baseColor` chosen to
  match the app's own token chroma — `neutral` for achromatic `oklch(L 0 0)` tokens);
  never run a fresh `shadcn init` on an app that already has `components/ui/` (it
  re-scaffolds base primitives and rewrites the Tailwind entry CSS); and one primitive
  foundation per app (compose the combobox from Radix `Popover` + `cmdk` `Command`,
  don't let `add` pull in a second Base UI foundation). Also documents shadcn's
  Sept-2026 `cn`-package change — registry components now import `cn` from the `cn`
  package; adopt it on a pre-existing project with `shadcn migrate cn`. Prompted by an
  `app/` port that shipped the vendored primitives without their `components.json`,
  leaving the CLI unusable. §4's `src/components/` row now points at `components.json`.

## 1.2.0 — 2026-09-05

- Added §5.1 "Function signatures": prefer a single options object over positional
  parameters in any custom function you write (server or browser), with a single
  obvious argument left positional and an explicit carve-out for framework-owned
  signatures — TanStack server functions (`{ data, context }`), React components
  (props) and hooks, and other framework callbacks. Extended review-checklist item
  9 to cover it.
- Added a §3 naming rule: the service wears no role-tag — the bare slice name _is_
  the service, so no `-service` suffix or prefix (`order.ts`, never
  `order-service.ts`). Extends the existing dotted-tag ban and reinforced in the §4
  layer table. Matches refapp and ctsheets.

## 1.1.0 — 2026-08-26

- Added §4 "Project structure": one folder per slice under `src/`, with the filename
  suffix naming the layer; no barrels; one client-safe module (`-validators`) per
  aggregate; fixed homes for cross-cutting code (`routes/`, `components/`, `db/`,
  `error/`, `lib/`, `test/`); and the downward dependency-direction constraint.
  Distilled from refapp's `domain-folders.md` and ctsheets' `slice-folders.md`.
- Renumbered former §4–§13 to §5–§14 and updated every cross-reference and anchor.

## 1.0.0 — 2026-08-26

- Extracted verbatim from refapp's root `CODING_STANDARDS.md` (702 lines) as the
  single source of truth. No content change from the previously copy-pasted version;
  refapp and ctsheets already carried byte-identical copies.
