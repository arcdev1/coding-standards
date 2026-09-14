# Changelog

All notable changes to the Arcnovus TanStack Start coding standard.

Versioning: `MAJOR.MINOR.PATCH` in [`VERSION`](VERSION), bumped on every content
change, with the commit tagged `v<version>`. `MAJOR` = a rule changed or was removed
in a way that could fail existing code review; `MINOR` = a rule added; `PATCH` =
wording, examples, or typo fixes with no change in what passes.

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
