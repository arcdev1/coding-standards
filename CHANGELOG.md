# Changelog

All notable changes to the Arcnovus TanStack Start coding standard.

Versioning: `MAJOR.MINOR.PATCH` in [`VERSION`](VERSION), bumped on every content
change, with the commit tagged `v<version>`. `MAJOR` = a rule changed or was removed
in a way that could fail existing code review; `MINOR` = a rule added; `PATCH` =
wording, examples, or typo fixes with no change in what passes.

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
