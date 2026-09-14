# Coding standards

A self-contained standard for building a full-stack web application on the
TanStack Start stack. It assumes no other document: every rule states its
mechanism and its reason inline, with an example where one helps. Copy this file
into a project and it is the whole standard.

_Current-state document — edit it in place, and keep it the single source. Record
the reasoning behind a change where your team keeps decisions (an ADR log), not
in this file's prose._

## How this standard relates to a project's own docs

This file is the **portable rule set** — copy it into a project and it stands
alone. On top of it a project keeps two current-state companions:
**`docs/conventions/`**, the same rules as worked examples against that app's own
domain (each linking its decision record), and **`docs/adr/`**, short records of
what was decided and why. The standard states the rule, a convention shows it in the
codebase, the ADR says why. Conventions and code comments are current-state: edit
them in place and let git hold the history. Do not write "used to" or "previously"
into a comment; what changed lives in git and, where it was a decision, in an ADR.

**Superseded records leave the read path, they are not deleted.** An accepted ADR's
decision is not rewritten in place. When a later ADR supersedes it, mark the old one
with a machine-readable `status:` (`superseded by ADR NNNN`) plus a forward link,
distill the body to the decision and the reasons that carry forward (dropping the
implementation detail the successor now owns), and move it under a status-gated path
such as `docs/adr/superseded/` so it leaves the default grep and retrieval set. The
reason is agent freshness rot: a keyword or vector search ranks a superseded record
as readily as its replacement, and higher the longer it has been in the tree, so a
superseded record left on the read path pulls stale guidance into an agent's context
as if it were current. git is the recovery backstop, not the agent's read path.

## The stack these standards assume

The rules are written for this stack. Swap a layer and re-read the affected
section; the principles carry, the specifics may not.

- **Framework:** TanStack Start (full-stack React), TanStack Router (file-based
  routing), React 19, TypeScript, Vite.
- **Server state & forms:** TanStack Query, TanStack Form.
- **Data:** Drizzle ORM over PostgreSQL (`node-postgres`).
- **Auth:** Better Auth.
- **UI:** Tailwind CSS, shadcn/ui over Radix primitives.
- **Validation:** Zod.
- **Tests:** Vitest (unit and integration), Playwright with playwright-bdd (E2E).
- **Tooling:** ESLint, Prettier, pnpm.

## How to use this document

- **Writing code:** read [§0](#0-first-principle-idiomatic-stack-first) and the
  section for the layer you're touching before you start.
- **Reviewing code:** run the diff against the [review checklist](#14-review-checklist)
  and the [code-smell baseline](#13-code-smell-baseline), on top of the per-layer
  rules.
- **Skip what tooling enforces.** Formatting, import order, and the compiler
  errors in [§2](#2-formatting-lint-and-types-automated) are caught by the
  automated gate. Spend review attention on the rules a machine can't check.

---

## 0. First principle: idiomatic stack first

Before writing any cross-cutting capability — data fetching, caching, server
state, forms, validation, routing, auth, HTTP calls, dates — use the primitive
your framework already provides. Reinventing a framework primitive is a defect,
not a matter of taste. An opinionated meta-framework has a canonical way to do
each of these; find it and follow it.

The blessed primitive for each concern on this stack:

| Concern               | Use                          | Not                                             |
| --------------------- | ---------------------------- | ----------------------------------------------- |
| Routing               | TanStack Router (file-based) | a hand-rolled router or manual history wiring   |
| Server data & caching | TanStack Query               | a bespoke fetch-and-cache layer                 |
| Forms & field state   | TanStack Form                | manual `useState` form wiring                   |
| Validation            | Zod schemas                  | ad-hoc `if` checks scattered across handlers    |
| DB access             | Drizzle                      | raw SQL strings or a hand-built query builder   |
| Auth                  | Better Auth                  | a hand-rolled session/password system           |
| Endpoint auth         | framework middleware         | a guard function called by hand in each handler |
| UI components         | shadcn/ui over Radix         | hand-built dialogs, selects, menus              |

If the right library isn't installed, propose adding it rather than hand-rolling a
substitute. If a bespoke mechanism is genuinely needed, state why the idiomatic
one doesn't fit before building it. Install shadcn components with the generator
(`pnpm dlx shadcn@latest add <name>`) rather than hand-authoring what it emits.

The generator needs a **committed `components.json`** — a required, checked-in file,
not a scaffolding by-product. Its canonical shape: `style: "new-york"`, `tsx: true`,
`rsc: false`, `tailwind.cssVariables: true`, `tailwind.config: ""` (Tailwind v4 has
no JS config), aliases on the repo's `#/` path (`components`, `ui`,
`utils: "#/lib/utils"`, `lib`, `hooks`), `iconLibrary: "lucide"`, and
`tailwind.baseColor` set to whichever base matches the app's own token chroma —
`neutral` for achromatic `oklch(L 0 0)` tokens, a tinted base (`zinc`, `stone`, …)
only when the tokens carry that base's hue. `baseColor` feeds token generation at
`init` only, so record the honest match even for a hand-tuned palette. Each app owns
its styling; this file states that app's choice, it does not standardize a palette.

**Never run a fresh `shadcn init` on an app that already has `components/ui/`.**
`init` re-scaffolds the base primitives — overwriting a customized
`button`/`input`/`textarea` — and rewrites the Tailwind entry CSS, destroying
hand-tuned tokens and any brand layer. Hand-write `components.json` instead, then use
`add` only, run from the directory that contains `src/` — the repo root for a flat
app, the app subfolder (e.g. `app/`) for a nested one.

**One primitive foundation per app.** The set sits on Radix (the unified `radix-ui`
package) plus `cmdk` for the command/combobox surface. Don't let `add` pull in a
second foundation: today `shadcn add combobox` resolves to a Base UI
(`@base-ui-components/react`) block — compose the combobox from a Radix `Popover` and
a `cmdk` `Command` instead of adopting a parallel primitive library.

**Expect the `cn` package (shadcn, Sept 2026+).** shadcn extracted `cn` into its own
npm package; registry components now `import { cn } from 'cn'` with no documented
opt-out. On a project that predates this, run `pnpm dlx shadcn@latest migrate cn`
once — it repoints the local combiner so `lib/utils` re-exports `cn` from the package
(the same source `add` output imports), making hand-ported components and new `add`
output share one implementation and removing any per-`add` fixup. Keep `lib/utils`
for any project-specific helpers it also holds.

Why: one canonical way per concern means every part of the app reads the same, and a
fix in the primitive reaches every caller — while an app ported without its
`components.json` can't run the generator at all, and a later `init` to create one
silently reverts every local component and token.

---

## 1. Language and imports

- **TypeScript with `strict` on, always.** The full strict configuration is in
  [§2](#2-formatting-lint-and-types-automated). Code that needs a strictness flag
  switched off is a design smell, not a config problem.
- **`import type` for type-only imports.** With `verbatimModuleSyntax` on, a value
  import used only as a type is a build error. Split a mixed import into a value
  `import { … }` and a separate `import type { … }`.
- **Use a stable internal import alias** instead of deep relative chains
  (`../../..`). Map `#/*` to `./src/*` with a `package.json` subpath import, which
  the bundler and TypeScript both honor:

  ```jsonc
  // package.json
  { "imports": { "#/*": "./src/*" } }
  ```

  ```jsonc
  // tsconfig.json
  { "compilerOptions": { "paths": { "#/*": ["./src/*"] } } }
  ```

  Then `import { db } from '#/db'` from anywhere. Reserve relative imports for
  siblings inside the same feature folder.

- **Name your exports.** Export named entry points from logic modules so the
  import name is stable and greppable; avoid default exports outside the files a
  framework convention requires them in (some route or config files).

---

## 2. Formatting, lint, and types (automated)

These are machine-enforced. **Do not flag them in review** — run the command.

**Prettier** — no semicolons, single quotes, trailing commas everywhere:

```js
// prettier.config.js
export default { semi: false, singleQuote: true, trailingComma: 'all' }
```

**TypeScript** — the strict baseline every module compiles under:

```jsonc
// tsconfig.json → compilerOptions
{
  "strict": true,
  "noUnusedLocals": true,
  "noUnusedParameters": true,
  "noFallthroughCasesInSwitch": true,
  "noUncheckedSideEffectImports": true,
  "verbatimModuleSyntax": true,
}
```

**ESLint** — start from your framework's shared config (for this stack,
`@tanstack/eslint-config`) and add as few deltas as possible. Let the config own
import ordering; don't reintroduce hand-review of it. **Keep `no-use-before-define`
off** (or set `{ functions: false }` if you enable it) so the stepdown module
order in [§5](#5-module-organization) stays legal.

**The gate.** Wire four package scripts so the names are stable, and require all
four green before any change lands:

| Script      | Runs                       |
| ----------- | -------------------------- |
| `check`     | Prettier in check mode     |
| `lint`      | ESLint                     |
| `typecheck` | `tsc --noEmit`             |
| `test`      | the unit/integration suite |

---

## 3. Naming

**Dash names a module; the dot marks structure.**

- **Dash (kebab-case) names a module** — the whole name is one concept:
  `app-error.ts`, `auth-client.ts`, `order-repo.ts`.
- **Dot marks a delimiter a tool or the framework acts on** — file-based route
  segments (`posts.$postId.tsx` → `/posts/$postId`), generated files (`*.gen.ts`),
  and ecosystem suffixes tools glob (`.test`, `.config`, `.d`).
- **No dotted role-tags** (`*.service.ts`, `*.middleware.ts`). Nothing globs them,
  and inside a file-based routes folder a dot already means a route segment — one
  character with two meanings. Rule of thumb: if a tool globs the suffix, use a
  dot; otherwise use a dash.
- **The service wears no role-tag — the bare slice name _is_ the service.** Every
  other layer in a slice carries a dash suffix (`order-repo`, `order-fns`,
  `order-validators`), so the unmarked module is the unambiguous front door:
  `order.ts` is the `order` service, the slice's only entry point
  ([§4](#4-project-structure), [§8](#8-domain--service-layer-and-validation)). Add
  no `-service` tag in either position — `order-service.ts` and `service-order.ts`
  are both redundant, and the _absence_ of a suffix is the signal that says "this
  is the front door." (Extends the dotted-tag ban above: no `*.service.ts`, and no
  `-service` either.)
- **Identifiers reveal intent.** A function, variable, or type whose name doesn't
  say what it does or holds is a [Mysterious Name](#13-code-smell-baseline). Rename
  it; if no honest name comes, the design underneath is murky.

---

## 4. Project structure

**One folder per slice under `src/`; the filename suffix names the layer.** A
slice is one bounded concern — an aggregate (`order/`, `invoice/`), a feature or
process (`export/`, `ingestion/`), or a value concept (`money/`). Everything about
it lives in its folder, named for its entity in the singular using the project's
own domain vocabulary — the word the glossary already uses. A slice that names a
process, not an entity, is exempt from the singular rule.

Inside a slice, the suffix carries the layer, so a reader knows what a file is
before opening it:

| File                    | Layer                                                                                            |
| ----------------------- | ------------------------------------------------------------------------------------------------ |
| `<slice>-validators.ts` | Client-safe Zod schemas and pure field rules ([§8](#8-domain--service-layer-and-validation))     |
| `<slice>.ts`            | The domain service, the slice's only entry point — bare name, no `-service` tag ([§8](#8-domain--service-layer-and-validation)) |
| `<slice>-repo.ts`       | Data access ([§7.2](#72-data-access-modules-repositories))                                        |
| `<slice>-fns.ts`        | The transport edge: server functions over the service ([§6](#6-server--client-boundary))         |
| `<slice>-queries.ts`    | TanStack Query options over the server functions ([§0](#0-first-principle-idiomatic-stack-first)) |

A single aggregate is the worked example — for `order/`: `order-validators.ts`,
`order.ts`, `order-repo.ts`, `order-fns.ts`, `order-queries.ts`, each test beside
its module. Copy its shape for a new slice.

- **No barrels.** A slice holds server-only modules (`-repo`, the service) beside
  its one client-safe module (`-validators`), so an `index.ts` re-export would pull
  server code into any client importer. A slice folder has no `index.ts`; consumers
  import the specific module ([§6](#6-server--client-boundary)).
- **One client-safe module per aggregate** — the `-validators.ts`. It answers "what
  may the browser import from this slice?" Enumerate the client-safe set in a
  manifest the boundary test reads, so the test enforces the split.
- **A satellite earns its file.** A pure rule with one consumer folds into that
  consumer, its unit test keeping its own file and importing the host module. Split
  a satellite out only when folding would cost a fast pure test or collapse a
  deliberate boundary.
- **Tests sit beside their module**, named after it (`order.test.ts`,
  `order-validators.test.ts`).

**Cross-cutting code that no slice owns has fixed homes:**

| Folder            | Holds                                                                                                                        |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `src/routes/`     | File-based route tree. Route-only, non-routable helpers go in a `-`-prefixed folder the router ignores (e.g. `-components/`). |
| `src/components/` | Shared components; `components/ui/` is the shadcn primitive set, configured by the committed `components.json` ([§0](#0-first-principle-idiomatic-stack-first)). A feature's own component cluster gets a subfolder. |
| `src/db/`         | Drizzle schema, the client singleton (`index.ts`), generated auth schema.                                                    |
| `src/error/`      | `app-error` and the error middleware.                                                                                        |
| `src/lib/`        | Cross-cutting kernels and infra with no owning slice: id, the server-only guard, the query client, theme, the datetime kernel. A large kernel gets its own subfolder (`lib/datetime/`), no barrel. |
| `src/test/`       | Shared test helpers and fixtures.                                                                                            |

Move a module out of `lib/` the moment it gains a single owning slice.

**Dependency direction is a design constraint.** Slices depend downward toward
shared kernels; a composition root (the auth singleton) may import the slices it
wires, but slices do not cycle through each other. Two slices importing each other
at runtime means one is misfiled.

---

## 5. Module organization

**Read top-down: exports first, helpers beneath, leaves last.** TypeScript hoists
`function` declarations, so definition order is a free choice. Choose the order
that puts a module's purpose before its mechanism.

A module opens with its doc comment, then its **exported entry points, highest
level first**, then each helper **directly beneath the function that first calls
it**, down to leaf helpers at the foot. A reader moving top to bottom meets what
the module does before how it does it.

```ts
/**
 * Domain service for the `order` aggregate. Owns the rules the data layer can't
 * express and stamps the owner from the caller's context. Server-only.
 */
export async function placeOrder(opts: PlaceOrderOptions) {
  const clean = cleanOrder(opts.input) // ↓ defined below its caller
  return insertOrder({ context: opts.context, query: { input: clean } })
}

function cleanOrder(input: OrderInput): CleanOrder {
  /* … */
}
```

- **Every module opens with a `/** … */` doc comment** stating what it does, and —
  for a server-only module — its boundary.
- **Hoist with `function` declarations.** A helper that sits above its first caller
  must be a `function` declaration (hoisted and callable before its own line), not
  a `const` arrow (which lives in a temporal dead zone and throws if called
  before its line runs).
- **`const` data respects the temporal dead zone.** Read a `const` lookup table or
  separator only from inside a function body (deferred to call time), or place it
  above any top-level code that reads it. Types are erased and carry no ordering
  constraint.
- **Scope.** This governs `.ts` modules that carry logic (service, data-access,
  and library layers). Component files keep their component-first idiom, which is
  already top-down. Test files are exempt.

### 5.1 Function signatures

**Prefer a single options object over positional parameters in the code you
write.** A named object reads at the call site without counting arguments, takes
a new field without reordering every caller, and matches the shapes already in
this standard — the service's `placeOrder({ context, input })`
([above](#5-module-organization)) and the data-access `{ context, query }`
([§7.2](#72-data-access-modules-repositories)). This governs any function you
author — service, data-access, library, and client-side utilities alike, server
or browser. The one exception is a signature a framework already owns (below).

```ts
// ✗ positional — the call site is a puzzle: reconcile(order, true, false)
export function reconcile(order: Order, dryRun: boolean, force: boolean) {}

// ✓ one options object — every argument names itself at the call site
export function reconcile(opts: {
  order: Order
  dryRun?: boolean
  force?: boolean
}) {}
```

- **A single, obvious argument stays positional.** One well-named parameter is
  already self-documenting, so wrapping it earns nothing: `cleanOrder(input)`
  ([above](#5-module-organization)) stays `cleanOrder(input)`, not
  `cleanOrder({ input })`. Reach for the object at the second parameter — or at
  the first when a boolean or another field is already coming. The data-access
  layer is stricter and always takes the object, even for a lone criterion
  ([§7.2](#72-data-access-modules-repositories)).

- **A framework-owned signature follows the framework, never this rule.** Where
  a framework hands your function its arguments, use the shape it passes — the
  first principle ([§0](#0-first-principle-idiomatic-stack-first)) decides the
  tie. This is not a server/client split; it's about who owns the signature:
  - **TanStack server functions** take input through `.validator(schema)` and
    hand the handler the framework's `{ data, context }` object. Use it as
    given; translate to your service's shape inside the body.

    ```ts
    export const placeOrderFn = createServerFn({ method: 'POST' })
      .validator(orderCreateSchema) //          input arrives as `data`
      .handler(({ data, context }) => //         the framework's shape, not ours
        placeOrder({ context, input: data }),
      )
    ```
  - **React components take props; hooks take their conventional arguments.** A
    component's single `props` object is already the idiom, and a hook keeps its
    ordered arguments (`useThing(id, options)`). Don't reshape either into a
    house options object. Component and hook files keep their own idiom
    throughout ([§5](#5-module-organization), Scope).
  - **Any other framework callback** — a route loader, a middleware, an event
    handler — receives the arguments the framework defines. Match them.

Why: one call convention across the code you write means a reader learns
argument shapes once; deferring to the framework where it owns the signature
keeps the app reading as idiomatic TanStack and React, not a house dialect
layered on top.

---

## 6. Server / client boundary

**A server-only module never shares a file with client-imported code.** Only
**server-function handler bodies** are stripped from the client bundle. A
top-level singleton like `export const auth = betterAuth(…)` is **not** stripped,
so if any client component imports anything from that file, the whole module —
database credentials, auth secrets — ships to the browser.

- **Split the pairs, and add no barrel.** Keep the server auth instance in one file
  and the browser auth client in another; keep an isomorphic store separate from
  the server functions that read cookies. A barrel that re-exports both sides
  reintroduces the leak.
- **Guard the leaf modules that hold secrets.** Give the database client and the
  auth instance a first-line import of a guard that throws if the module is ever
  evaluated in the client bundle:

  ```ts
  // server-only.ts — throws at load if it runs in the browser bundle.
  // Keys off the bundler's SSR flag; stays inert on the server, during SSR,
  // and under the test runner.
  if (import.meta.env.SSR === false) {
    throw new Error('a server-only module was imported into the client bundle')
  }
  ```

  ```ts
  // db/index.ts
  import '#/lib/server-only'
  // …create and export the Drizzle client
  ```

- **Do not put the guard on server-function modules or client-safe modules.**
  Server-function files are imported by client components to make the RPC call (the
  framework strips their bodies); schema, validators, and the browser auth client
  are meant to run in both places. Adding the guard there breaks the client build,
  which is exactly the signal that the module was never server-only.

---

## 7. Data layer

### 7.1 Schema and data modeling

Model so that invalid states can't be represented.

- **No boolean columns.** A boolean can't grow a third state and usually flattens
  richer information into yes/no. Reach for:
  - an **enum / status** (`pgEnum`) for a closed set of states — whether something
    happened or what state it's in (deleted, verified, published). Make the state
    explicit; don't infer it. Split enums so no table can hold a value that is
    meaningless for it.
  - an **ordinal `position`** for "which is primary / what order" (below).
  - a **nullable foreign key** for "the chosen one" among children.
- **A nullable timestamp is not a boolean substitute.** `deletedAt IS NULL` hides a
  two-valued flag in a temporal column and conflates "hasn't happened" with "time
  unknown", and it inherits every timestamp hazard (see [§7.3](#73-optimistic-locking)).
  A timestamp records _when_ an event happened; _whether_ it happened is state — an
  enum. When both matter, that's two columns.
- **Ordered owned collections use an ordinal `position`.**
  `position: smallint('position').notNull()` plus `unique(parentId, position)`.
  Primary is the lowest position; the same column carries display order; no
  `isPrimary` flag. Assign `position` from array order at write time — the parent's
  data-access module owns it.
- **Uniqueness spanning nullable columns must be `NULLS NOT DISTINCT`** (Postgres
  15+). By default `null ≠ null`, so two otherwise-identical rows that share a
  `null` both slip through:

  ```ts
  unique('order_line_uq').on(t.orderId, t.sku, t.variant).nullsNotDistinct()
  ```

### 7.2 Data-access modules (repositories)

Data access lives in server-only `*-repo.ts` modules: plain async functions over
the ORM, free of business rules.

- **One module per aggregate** (`order-repo.ts`), exporting plain functions that
  own the SQL, so callers — server functions, route loaders — never hand-write
  queries.
- **One options object `{ context, query }`; no positional params.** Every exported
  function takes a single argument with up to two keys:
  - **`context`** carries cross-cutting concerns. `tx` is its only optional field:
    an enlist-or-open transaction, so several calls compose atomically. Resolve the
    connection through two shared helpers, `conn(context)` (returning
    `context?.tx ?? db`) for reads and single writes and `inTransaction(context, work)`
    for writers. When the module scopes rows by owner (below), that owner scope is a
    required field of a required `context`; a module with no such scope can leave
    `context` itself optional.
  - **`query`** holds the call's own parameters, always as an object: the lookup
    criteria (`{ email }`) or the write payload (`{ id, expectedVersion, input }`).

  ```ts
  type OwnerScope = { kind: 'owner'; ownerId: string } | { kind: 'all' }

  export function findByEmail(opts: {
    context: { scope: OwnerScope; tx?: Transaction } // scope is required
    query: { email: string }
  }) {
    /* … WHERE email = :email AND <owner-scope clause> */
  }
  export function insertOrder(opts: {
    context: { owner: string; tx?: Transaction } // owner stamped here, never the payload
    query: { input: NewOrder } //                   NewOrder carries no ownerId
  }) {
    /* … */
  }
  ```

- **Owner scope is a required, closed value on `context`, and fails closed by
  construction.** When rows belong to owners and a caller may see only its own, the
  scope travels as a required field of a required `context`, typed as a closed union
  with no unset state. The union is
  `{ kind: 'owner'; ownerId } | { kind: 'all' }`; the `all` case is reserved for a
  caller the service has cleared to cross owners. Omitting the scope is a compile
  error, and the `WHERE` clause is exhaustive over the union, so a value that defeats
  the types matches no rows. Every read and write that could cross owners applies it,
  the finders included, so a new query cannot leak across owners by forgetting a
  filter. The scope is a value the service decides from the caller's permission; the
  module applies the clause and never sees a role. Create takes its owner from
  `context` the same way ([§8](#8-domain--service-layer-and-validation)).

- **Server-only.** A data-access module imports the DB client (driver and
  connection secrets), so it sits behind a server-function handler and is never
  imported by a client component ([§6](#6-server--client-boundary)).
- **No business rules here.** An invariant that can't be a database constraint
  belongs to the service layer above ([§8](#8-domain--service-layer-and-validation)).
  This layer does data, not policy.
- **Reads are total; only writers throw.** A finder returns a collection and never
  throws — no match is an empty collection, not an error. Even a by-id lookup
  returns a collection (`findMany`, not `findFirst`) so a should-be-impossible
  duplicate surfaces instead of being masked by "take the first". Deletes are
  idempotent (deleting an absent row is a no-op). Writers raise only for structural
  reasons — an optimistic-lock conflict, or not-found when the caller named a
  specific row to change — as `AppError` codes ([§9](#9-errors-and-middleware)).
- **Aggregate writes are transactional**, and on update **replace owned child
  collections wholesale** (delete + re-insert with fresh ordinals) rather than
  reconciling in place. Child rows are value objects with no identity worth
  preserving, and re-inserting sidesteps the in-place-reorder hazard from
  [§7.1](#71-schema-and-data-modeling).

### 7.3 Optimistic locking

Guard full-record updates with a `version` integer and a compare-and-swap, never
with a timestamp.

- **A table that accepts full-record updates carries a lock column:**
  `version: integer('version').default(0).notNull()`.
- **The update is a compare-and-swap.** The caller passes the `version` it last
  read; one statement checks it and bumps it:

  ```ts
  const rows = await tx
    .update(order)
    .set({ ...fields, version: sql`${order.version} + 1` })
    .where(and(eq(order.id, id), eq(order.version, expectedVersion)))
    .returning({ id: order.id })

  if (rows.length === 0) {
    // someone else won the race, or the row is gone → CONFLICT (409) / NOT_FOUND
  }
  ```

  Because the compare and the increment are one statement, concurrent updates
  can't interleave: exactly one racer's `UPDATE` matches.

- **Increment in SQL, never in app code.** A read-modify-write (`version: justRead
  - 1`) reintroduces the race.
- **Never use `updated_at` — or any timestamp — as the lock token.** Postgres
  timestamps store microseconds; the JavaScript `Date` they round-trip through
  holds only milliseconds, so `WHERE updated_at = <the Date you read>` matches zero
  rows and every update spuriously conflicts. A monotonic integer has no precision,
  timezone, or round-trip hazard.

### 7.4 Migrations

**Migrations are generated from the schema, never hand-written.** Change the
Drizzle schema in `src/db/`, then let Drizzle Kit diff it and emit the SQL:
`db:generate` writes the timestamped migration together with its snapshot and
journal entry, and `db:migrate` applies the pending files. Commit the generated
`.sql` and the `meta/` snapshot, but treat them as build output — do not hand-edit
them. Editing the emitted SQL, or dropping in a loose migration file, desyncs the
snapshot Drizzle diffs against, so the next `db:generate` produces a corrupt or
duplicated diff. The schema is the source of truth; the migration is its compiled
artifact.

**Reach for hand-written SQL only when the schema DSL genuinely can't express the
change** — a data backfill, an index built `CONCURRENTLY`, a constraint or trigger
Drizzle has no builder for. Even then, keep it inside the ledger: generate an empty,
tracked migration with `pnpm db:generate --custom` and write the SQL into that file,
so the journal stays ordered and the migration replays everywhere. A raw statement
run straight against a database, outside a generated migration, is off the table —
it leaves every other environment behind and can't be replayed.

**Run the migration tool only through a package script; never call it directly.**
Wrap every schema operation in a named script (`db:generate`, `db:migrate`,
`db:push`, `db:studio`, …) and always go through it — not the bare CLI, not
`pnpm exec`, not `pnpm dlx`. The script name is the stable interface; the command
and its flags, env loading, and ordering behind it are free to change in one place
and every caller (people, agents, CI) picks it up. This applies to agents too.

---

## 8. Domain / service layer and validation

The service layer sits between the edge (server functions, forms) and the
data-access layer, and owns the rules neither of them can.

- **The service is a deep, self-sufficient module.** Callers go through the service
  (`placeOrder`, `updateOrder`), never straight to a data-access function, so its
  rules can't be bypassed. The service alone guarantees a cleaned, normalized,
  rule-checked, owner-stamped result regardless of caller — which is why the
  integration tests call the service, not the HTTP edge ([§11](#11-testing)).
- **Validators are pure, lenient, and shared.** Write one validation schema with
  **no `.transform()`**, so its input and output types coincide and the single
  schema drops into both the server-function validator and the form's `validators`.
  Validate the **normalized** form so the schema accepts what a human types —
  judge the trimmed/lowercased value, but return the raw string:

  ```ts
  // No transform → input type = output type. The service still owns canonicalization.
  const email = z
    .string()
    .refine(
      (v) => z.email().safeParse(v.trim().toLowerCase()).success,
      'Enter a valid email address',
    )
  ```

  A strict schema over the raw value (`z.email()` on `" ada@x.com "`) rejects input
  a later clean would happily accept, leaking a normalization requirement onto the
  form and the user.

- **Cleaning and normalization live in the service, not the schema.** Trimming,
  empty-to-null, case-folding, and any identity keys your unique indexes compare
  stay in the service — its single home for folding. The overlap between the
  schema's lenient check and the service's clean is deliberate defense-in-depth,
  and it is safe **only because the operations are idempotent**. A non-idempotent
  normalization must never be duplicated across the two layers this way.
- **Stamp the owner from context, never the payload.** The inferred input type
  carries no `ownerId`; the service takes it from the session on `context`. A
  client can't assign ownership by editing its request.
- **Uniqueness is a service pre-check plus a database index, never an async schema
  refine.** A check-then-insert probe is a time-of-check/time-of-use race; only the
  unique index actually enforces dedup. The pre-check exists for a friendly error;
  the index is the guarantee.
- **Name a write-type for the boundary it serves.** A write-type family crosses the
  layers above in a fixed progression, and its names say so — the concept leads, a
  boundary suffix states where the type sits, so a reader knows a type's role
  without opening the module:

  **`*Payload` → `*Draft` → `*Write` / `*Insert` → `*Aggregate`**

  ```ts
  type OrderCreatePayload = z.infer<typeof orderCreateSchema> // untrusted wire input (no ownerId)
  type OrderDraft = /* … */ //                                    service clean/fold seam
  type OrderLineInsert = /* … */ //                               one-table row insert
  type OrderCreateWrite = /* … */ //                              aggregate write-request (root + lines)
  type OrderAggregate = /* … */ //                                fully-loaded read model
  ```

  `*Payload` is untrusted and carries no owner id or derived column, so a leak into
  the wire shape is obvious on sight; `*Insert` is one table's row and `*Write` is
  the whole aggregate. Keep the schema **values** unsuffixed (`orderCreateSchema`);
  only the inferred type aliases carry the suffix. Read-model (`*Aggregate`), form
  (`*FormValues`), and helper types (a `Pick`, the identity fold, query criteria)
  keep their names.

Where each concern lives:

| Concern                                                                | Home                                                           | Authority    |
| ---------------------------------------------------------------------- | -------------------------------------------------------------- | ------------ |
| Shape + format (lenient)                                               | the shared schema, run at the server-fn validator and the form | the schema   |
| Cleaning (trim, empty→null, case-normalize)                            | the service                                                    | the service  |
| Identity normalization (the keys unique indexes compare)               | the service (single home for folding)                          | the service  |
| Cross-field domain rule (e.g. "an order needs at least one line item") | the service                                                    | the service  |
| Uniqueness                                                             | service pre-check (friendly error) + DB unique index           | the DB index |

---

## 9. Errors and middleware

Deliberate failures are thrown as a typed `AppError` carrying a machine-readable
code; global middleware maps the code to an HTTP status.

- **Throw `new AppError(code, message?)` for every expected failure.** The **code**
  is the contract — the rest of the system branches on `code`; `message` is for
  humans. Wrap an underlying error through `options.cause`.

  ```ts
  export type ErrorCode =
    | 'UNKNOWN' // no more specific reason — the 422 catch-all
    | 'VALIDATION' // well-formed input that breaks a domain rule
    | 'NOT_FOUND'
    | 'NOT_AUTHENTICATED' // no valid session
    | 'FORBIDDEN' // authenticated, but the role lacks the permission
    | 'CONFLICT' // the write conflicts with existing state

  export class AppError extends Error {
    readonly code: ErrorCode
    constructor(code: ErrorCode, message?: string, options?: ErrorOptions) {
      super(message ?? code, options)
      this.code = code
      this.name = new.target.name
    }
  }
  ```

- **An `AppError` is always 4xx.** It means the server worked and is telling the
  caller what was wrong. A 5xx is reserved for a non-`AppError` throw (a real
  failure), which the mapping middleware leaves untouched. Unmapped codes fall back
  to 422.

  | Code                | Status         |
  | ------------------- | -------------- |
  | `NOT_AUTHENTICATED` | 401            |
  | `FORBIDDEN`         | 403            |
  | `NOT_FOUND`         | 404            |
  | `CONFLICT`          | 409            |
  | `VALIDATION`        | 422            |
  | `UNKNOWN`           | 422 (fallback) |

  Use `VALIDATION` for input that is well-formed but breaks a domain rule the type
  system and schema can't express. Use `CONFLICT` for an optimistic-lock clash or a
  uniqueness violation — both are the write disagreeing with existing state.

- **Cross-cutting request concerns are global middleware**, registered once at the
  app entry point, not repeated in each handler.
  - **Request middleware** runs on every server request (routes, SSR, server
    functions). Use it for concerns spanning all requests: CSRF, request logging,
    tracing.
  - **Function middleware** wraps only server-function handlers. Use it when you
    must catch or shape what a server function does — mapping a thrown `AppError`
    to a status is function middleware, because a server-function throw is caught
    and serialized by the framework before request middleware ever sees it.
  - **Order is outer-to-inner.** Put the error-mapping middleware first in the
    function chain so it wraps everything downstream.
- **Defining your own global-middleware entry point may disable the framework's
  auto-installed CSRF protection.** If it does, re-add CSRF explicitly, scoped to
  server-function calls, so page navigations and OAuth callbacks (legitimately
  cross-site) are left alone.
- **Fallback UI lives on the root route.** Set an app-wide `errorComponent` and
  `notFoundComponent` on the root route; any route may override either for a local
  boundary.

---

## 10. User experience and UI

- **Let the domain and its users decide the experience.** Choose interaction and
  layout patterns from what the app's users expect and find natural, and aim for an
  interface that is intuitive and a pleasure to use. No specific layout is mandated
  here. Whether a record opens in a side sheet, a modal, a split view, or its own
  page is a product decision, made against the domain and validated with its users.
- **Prefer established, accessible patterns.** Reach first for the platform
  conventions and the component-library primitives your users already understand,
  and adopt a novel interaction only where it clearly serves them. Accessibility is
  a requirement: keyboard operation, visible focus, sufficient contrast, and
  labelled controls on every interactive element.
- **Ship a public design-system route.** Carry a `/design-system` route that shows
  the app's tokens and components live, with the theme toggle, so both themes stay
  checkable and the component set has one home.
- **Theme resolves on the server, from a cookie.** Read the light/dark/system
  choice from a first-party cookie plus the client's color-scheme hint, render the
  resolved theme server-side, and add a pre-paint script as the fallback for
  `system`, so there is no flash on load.
- **Design tokens are CSS variables defined once per theme.** Components and app
  code read the same variables, so a token change propagates everywhere. Derive
  presentational values that can be derived (for example, a stable accent color
  from a hash of a name) rather than storing them.

### List reordering

- **Array order is the source of truth.** Hold an ordered collection as an array in
  form state; a drag splices that array into its new order. There is no `position`
  property on the in-memory items to keep in sync — the array is the order.
  `position` is only the **persistence encoding**, derived from array index at
  write time and read back with `orderBy(position)` ([§7.1](#71-schema-and-data-modeling)).
  Reordering then needs no schema or wire change: the wholesale-replace update path
  can't tell a reorder from any other edit.
- **Move array elements with the form library's array primitive** (its
  `moveValue(from, to)`), which matches the `arrayMove(items, from, to)` a sortable
  library performs on a plain array. Keeping one representation — the field array —
  means one move updates both the rendered order and what gets submitted.
- **Use a maintained, accessible sortable library** (`@dnd-kit/core` +
  `@dnd-kit/sortable` on this stack); don't hand-roll drag state. Scope each
  sortable group to its own drag context so a drag only reorders within one group.

---

## 11. Testing

- **Test against a disposable, isolated database — never the development
  database.** Provision and migrate a throwaway database per test session (and per
  test-runner worker) so suites run in parallel without colliding. Add a guard that
  throws before any query if the resolved connection string points outside the
  test-database family, so a run can never touch dev data.
- **Never mock the database or substitute an in-memory shim** (such as PGLite). Run
  against the same engine you ship on (PostgreSQL), so tests exercise real
  constraints, types, and transactions.
- **Assert external behavior through a module's exported API**, at the highest
  existing seam — the service for an aggregate — never private internals or the
  order of declarations inside a file. A refactor that preserves behavior must not
  require a test change.
- **E2E drives the real app through a browser.** Use Playwright with playwright-bdd
  (Gherkin `.feature` files compiled to specs). Run serially (`workers: 1`) when
  scenarios share global state, and tag every record a scenario creates with a
  recognizable marker so a teardown step can sweep it, keeping a reused E2E
  database clean.
- **Isolate parallel work without hardcoding.** Derive the dev-server port and the
  test-database name deterministically from the worktree's identity (for example, a
  hash of its path), so many worktrees or checkouts run at once without collision.
  Never hardcode a port or pass `--port`, and never point a test at the dev
  database.

---

## 12. Version control and workflow

- **One package manager, used consistently.** This stack uses pnpm (`pnpx`, not
  `npx`); don't mix in npm or yarn, whose lockfiles and install behavior diverge.
- **Work on a feature branch; the merge is the human gate.** An automated
  contributor may commit and push to its own feature branch without being asked.
  Merging into the default (shared) branch requires explicit human approval. Never
  merge a pull request without it, and never commit directly to the default branch.
- **Never bypass hooks** (`--no-verify`), and never rewrite already-shared history:
  no amend, rebase, or force-push on the default branch or a branch someone else is
  building on.
- **Every commit leaves the automated gate green** — `check`, `lint`, `typecheck`,
  and the tests all pass ([§2](#2-formatting-lint-and-types-automated)).
- **Record cross-cutting decisions as ADRs** in the repository, so the reasoning is
  durable and these standards and the code stay consistent as the app grows.

---

## 13. Code-smell baseline

Beyond the rules above, review carries this fixed set of code smells (Martin
Fowler, _Refactoring_, ch. 3). It applies even to code that breaks no explicit
rule in this document. Two rules bind it:

- **A documented standard overrides.** Any rule in this file wins; where it
  endorses something the baseline would flag, suppress the smell.
- **Every smell is a judgement call** — a labelled heuristic ("possible Feature
  Envy"), never a hard violation — and you still skip anything tooling already
  enforces ([§2](#2-formatting-lint-and-types-automated)).

Each reads _what it is_ → _how to fix_:

- **Mysterious Name** — a function, variable, or type whose name doesn't reveal
  what it does or holds. → rename it; if no honest name comes, the design's murky.
- **Duplicated Code** — the same logic shape in more than one place. → extract the
  shared shape, call it from both.
- **Feature Envy** — a function that reaches into another object's data more than
  its own. → move it onto the data it envies.
- **Data Clumps** — the same few fields or params keep travelling together. →
  bundle them into one type, pass that.
- **Primitive Obsession** — a primitive or string standing in for a domain concept
  that deserves its own type. → give the concept its own small type.
- **Repeated Switches** — the same `switch`/`if`-cascade on the same type recurs. →
  replace with polymorphism, or one map both sites share.
- **Shotgun Surgery** — one logical change forces scattered edits across many
  files. → gather what changes together into one module.
- **Divergent Change** — one module is edited for several unrelated reasons. →
  split so each module changes for one reason.
- **Speculative Generality** — abstraction, parameters, or hooks added for needs
  the spec doesn't have. → delete it; inline back until a real need shows.
- **Message Chains** — long `a.b().c().d()` navigation the caller shouldn't depend
  on. → hide the walk behind one method on the first object.
- **Middle Man** — a class or function that mostly just delegates onward. → cut it,
  call the real target directly.
- **Refused Bequest** — a subclass or implementer that ignores most of what it
  inherits. → drop the inheritance, use composition.

---

## 14. Review checklist

Run the diff against these, in order. The first is automated; spend human and
agent attention on the rest.

1. **Automated gate green?** `check`, `lint`, `typecheck`, and the tests pass.
   Don't hand-review anything these catch ([§2](#2-formatting-lint-and-types-automated)).
2. **Stack-first?** No hand-rolled substitute for a blessed primitive
   ([§0](#0-first-principle-idiomatic-stack-first)).
3. **Boundary intact?** No server-only code reachable from the client bundle; no
   new barrel merging a server/client pair ([§6](#6-server--client-boundary)).
4. **Data rules?** No boolean columns, no timestamp-as-flag, an ordinal `position`
   for ordered collections, `NULLS NOT DISTINCT` on nullable unique constraints
   ([§7.1](#71-schema-and-data-modeling)).
5. **Data-access shape?** A `{ context, query }` options object, total
   non-throwing readers, idempotent deletes, transactional aggregate writes, no
   business rules in the layer ([§7.2](#72-data-access-modules-repositories)).
6. **Locking?** A `version` compare-and-swap incremented in SQL; no timestamp lock
   token ([§7.3](#73-optimistic-locking)).
7. **Migrations generated?** The schema change was compiled to a migration with
   `db:generate` and applied with `db:migrate`; the generated SQL and snapshot are
   committed but not hand-edited; raw SQL only through a tracked
   `db:generate --custom` migration ([§7.4](#74-migrations)).
8. **Errors?** Expected failures are `AppError` codes, always 4xx, with status set
   by the function middleware ([§9](#9-errors-and-middleware)).
9. **Validation home?** A lenient pure validator shared with the form; cleaning and
   normalization owned by the service; owner from context, not payload
   ([§8](#8-domain--service-layer-and-validation)).
10. **Module order & signatures?** Doc comment, then exports, then helpers stepping
    down; hoisted helpers written as `function` declarations; a single options
    object for any multi-argument function you write, deferring to framework-owned
    signatures ([§5](#5-module-organization)).
11. **Tests at the right seam?** Behavior through the exported API against an
    isolated test database, not internals ([§11](#11-testing)).
12. **Smell pass** — walk [§13](#13-code-smell-baseline) and flag findings as
    judgement calls, not hard violations.
