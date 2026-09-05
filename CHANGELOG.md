# Changelog

All notable changes to the Arcnovus TanStack Start coding standard.

Versioning: `MAJOR.MINOR.PATCH` in [`VERSION`](VERSION), bumped on every content
change, with the commit tagged `v<version>`. `MAJOR` = a rule changed or was removed
in a way that could fail existing code review; `MINOR` = a rule added; `PATCH` =
wording, examples, or typo fixes with no change in what passes.

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
