---
name: tanstack-start
title: TanStack Start
summary: Full-stack React on TanStack Start, with Drizzle over PostgreSQL, Better Auth, shadcn/ui, Vitest and playwright-bdd.
---

<!-- slot: stack -->
- **Framework:** TanStack Start (full-stack React), TanStack Router (file-based
  routing), React 19, TypeScript, Vite.
- **Server state & forms:** TanStack Query, TanStack Form.
- **Data:** Drizzle ORM over PostgreSQL (`node-postgres`).
- **Auth:** Better Auth.
- **UI:** Tailwind CSS, shadcn/ui over Radix primitives.
- **Validation:** Zod.
- **Tests:** Vitest (unit and integration), Playwright with playwright-bdd (E2E).
- **Tooling:** ESLint, Prettier, pnpm.
<!-- /slot -->

<!-- slot: 0 -->
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

Install shadcn components with the generator (`pnpm dlx shadcn@latest add <name>`)
rather than hand-authoring what it emits.

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

Why the generator rules: an app ported without its `components.json` can't run the
generator at all, and a later `init` to create one silently reverts every local
component and token.
<!-- /slot -->

<!-- slot: 1 -->
- **`import type` for type-only imports.** With `verbatimModuleSyntax` on, a value
  import used only as a type is a build error. Split a mixed import into a value
  `import { … }` and a separate `import type { … }`.
- **The stable import path is the `#/` alias.** Map `#/*` to `./src/*` with a
  `package.json` subpath import, which the bundler and TypeScript both honor:

  ```jsonc
  // package.json
  { "imports": { "#/*": "./src/*" } }
  ```

  ```jsonc
  // tsconfig.json
  { "compilerOptions": { "paths": { "#/*": ["./src/*"] } } }
  ```

  Then `import { db } from '#/db'` from anywhere.

- **Named exports.** Export named entry points from logic modules; avoid default
  exports outside the files a framework convention requires them in (some route or
  config files).
<!-- /slot -->

<!-- slot: 2 -->
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

The five steps are package scripts:

| Script      | Runs                                              |
| ----------- | ------------------------------------------------- |
| `check`     | `prettier --check .`                              |
| `lint`      | `eslint`                                          |
| `typecheck` | `tsc --noEmit`                                    |
| `test`      | `vitest`, the unit/integration suite              |
| `test:e2e`  | `bddgen && playwright test`, the end-to-end suite |
<!-- /slot -->

<!-- slot: 3 -->
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
- **The service file is the bare slice name**: `order.ts` is the `order` service.
  Every other layer carries a dash suffix (`order-repo`, `order-fns`,
  `order-validators`). `order-service.ts` and `service-order.ts` are both redundant,
  and so is `*.service.ts`.
<!-- /slot -->

<!-- slot: 4 -->
Slices live under `src/`, one folder each. Inside a slice, the filename suffix names
the layer:

| File                    | Layer                                                                                            |
| ----------------------- | ------------------------------------------------------------------------------------------------ |
| `<slice>-validators.ts` | Client-safe Zod schemas and pure field rules ([§8](#8-domain--service-layer-and-validation))     |
| `<slice>.ts`            | The domain service, the slice's only entry point — bare name, no `-service` tag ([§8](#8-domain--service-layer-and-validation)) |
| `<slice>-repo.ts`       | Data access ([§7.2](#72-data-access-modules-repositories))                                        |
| `<slice>-fns.ts`        | The transport edge: server functions over the service ([§6](#6-server--client-boundary))         |
| `<slice>-queries.ts`    | TanStack Query options over the server functions ([§0](#0-first-principle-idiomatic-stack-first)) |

A single aggregate is the worked example — for `order/`: `order-validators.ts`,
`order.ts`, `order-repo.ts`, `order-fns.ts`, `order-queries.ts`, each test beside
its module (`order.test.ts`, `order-validators.test.ts`). Copy its shape for a new
slice.

- **No barrels.** A slice holds server-only modules (`-repo`, the service) beside
  its one client-safe module (`-validators`), so an `index.ts` re-export would pull
  server code into any client importer. A slice folder has no `index.ts`; consumers
  import the specific module ([§6](#6-server--client-boundary)).
- **One client-safe module per aggregate** — the `-validators.ts`. It answers "what
  may the browser import from this slice?" Enumerate the client-safe set in a
  manifest the boundary test reads, so the test enforces the split.

The fixed homes for cross-cutting code:

| Folder            | Holds                                                                                                                        |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `src/routes/`     | File-based route tree. Route-only, non-routable helpers go in a `-`-prefixed folder the router ignores (e.g. `-components/`). |
| `src/components/` | Shared components; `components/ui/` is the shadcn primitive set, configured by the committed `components.json` ([§0](#0-first-principle-idiomatic-stack-first)). A feature's own component cluster gets a subfolder. |
| `src/db/`         | Drizzle schema, the client singleton (`index.ts`), generated auth schema.                                                    |
| `src/error/`      | `app-error` and the error middleware.                                                                                        |
| `src/lib/`        | Cross-cutting kernels and infra with no owning slice: id, the server-only guard, the query client, theme, the datetime kernel, the `Result` type ([§5.2](#52-return-values)). A large kernel gets its own subfolder (`lib/datetime/`), no barrel. |
| `src/test/`       | Shared test helpers and fixtures.                                                                                            |
<!-- /slot -->

<!-- slot: 5 -->
TypeScript hoists `function` declarations, so definition order is a free choice:

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

- **Hoist with `function` declarations.** A helper that sits above its first caller
  must be a `function` declaration (hoisted and callable before its own line), not
  a `const` arrow (which lives in a temporal dead zone and throws if called
  before its line runs).
- **`const` data respects the temporal dead zone.** Read a `const` lookup table or
  separator only from inside a function body (deferred to call time), or place it
  above any top-level code that reads it. Types are erased and carry no ordering
  constraint.
<!-- /slot -->

<!-- slot: 5.1 -->
The named-argument form is **a single options object**:

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

The framework-owned signatures on this stack:

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
<!-- /slot -->

<!-- slot: 5.2 -->
```ts
// ✗ a tuple: the caller has to remember which slot is which
return [order, true]

// ✓ a named object
return { order, operation: 'insert' }
```

Zod's `safeParse` is the model for a `Result`. Define the type once, client-safe,
in `src/lib/result.ts`:

```ts
/** The outcome of a function whose failures are branches its caller handles. Client-safe. */
export type Result<T, E extends { code: string }> =
  | { ok: true; value: T }
  | { ok: false; error: E }
```

Declare the return type and return plain literals; the compiler checks each literal
against the declared type, so no `ok()` or `err()` constructors are needed. Add no
Result library (neverthrow, Effect, and the like): their chaining API (`andThen`,
`ResultAsync`) reads unlike the rest of a TanStack app, and narrowing on `ok` covers
the need.

```ts
export type OrderMatch = Result<
  Order,
  { code: 'NO_MATCH' } | { code: 'AMBIGUOUS'; candidates: Order[] }
>

export async function matchOrder(opts: MatchOrderOptions): Promise<OrderMatch> {
  const candidates = await findByReference({
    context: opts.context,
    query: { reference: opts.reference },
  })
  if (candidates.length === 0) return { ok: false, error: { code: 'NO_MATCH' } }
  if (candidates.length > 1)
    return { ok: false, error: { code: 'AMBIGUOUS', candidates } }
  return { ok: true, value: candidates[0] }
}

// The caller: a rejected row is recorded and the batch continues.
for (const row of rows) {
  const match = await matchOrder({ context, reference: row.reference })
  if (!match.ok) {
    rejected.push({ row, reason: match.error.code })
    continue
  }
  applied.push(await applyPayment({ context, order: match.value, row }))
}
return { applied, rejected }
```

Why the edge rules bite here: TanStack Query caches a server function's
`{ ok: false }` as a successful response, the router's `errorComponent` never sees
it, and the [§9](#9-errors-and-middleware) middleware maps no status; Drizzle rolls
back only when the `inTransaction` callback throws.
<!-- /slot -->

<!-- slot: 6 -->
Only **server-function handler bodies** are stripped from the client bundle. A
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
<!-- /slot -->

<!-- slot: 7.1 -->
In Drizzle: a status is a `pgEnum`; the ordinal is
`position: smallint('position').notNull()` plus `unique(parentId, position)`; and a
nullable unique constraint is

```ts
unique('order_line_uq').on(t.orderId, t.sku, t.variant).nullsNotDistinct()
```
<!-- /slot -->

<!-- slot: 7.2 -->
Data-access modules are server-only `*-repo.ts` files. Resolve the connection through
two shared helpers, `conn(context)` (returning `context?.tx ?? db`) for reads and
single writes and `inTransaction(context, work)` for writers. A by-id lookup uses
`findMany`, not `findFirst`.

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

<!-- /slot -->

<!-- slot: 7.3 -->
In Drizzle, the lock column is `version: integer('version').default(0).notNull()`,
and the compare-and-swap is:

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
<!-- /slot -->

<!-- slot: 7.4 -->
The schema lives in `src/db/`, and Drizzle Kit is the migration tool: `db:generate`
writes the timestamped migration together with its snapshot and journal entry, and
`db:migrate` applies the pending files. Commit the generated `.sql` and the `meta/`
snapshot. For SQL the schema DSL can't express, generate an empty, tracked migration
with `pnpm db:generate --custom`. Go through the package scripts (`db:generate`,
`db:migrate`, `db:push`, `db:studio`, …), never the bare CLI, `pnpm exec`, or
`pnpm dlx`.
<!-- /slot -->

<!-- slot: 8 -->
The shared schema is Zod, with **no `.transform()`**, so the one schema drops into
both the server-function validator and the form's `validators`:

```ts
// No transform → input type = output type. The service still owns canonicalization.
const email = z
  .string()
  .refine(
    (v) => z.email().safeParse(v.trim().toLowerCase()).success,
    'Enter a valid email address',
  )
```

The write-type family, with the inferred types carrying the suffix:

```ts
type OrderCreatePayload = z.infer<typeof orderCreateSchema> // untrusted wire input (no ownerId)
type OrderDraft = /* … */ //                                    service clean/fold seam
type OrderLineInsert = /* … */ //                               one-table row insert
type OrderCreateWrite = /* … */ //                              aggregate write-request (root + lines)
type OrderAggregate = /* … */ //                                fully-loaded read model
```
<!-- /slot -->

<!-- slot: 9 -->
The app error is `AppError`, in `src/error/`. Throw `new AppError(code, message?)`
and wrap an underlying error through `options.cause`:

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
<!-- /slot -->

<!-- slot: 10 -->
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
<!-- /slot -->

<!-- slot: 11.1 -->
playwright-bdd compiles the feature files into Playwright specs with `bddgen`.

- **Undefined steps fail generation.** Keep playwright-bdd's default
  `missingSteps: 'fail-on-gen'`.
- **Exclude `@pending` at generation**: `defineBddConfig({ tags: 'not @pending', … })`,
  so its undefined steps do not fail `bddgen`.
- **Run serially with `workers: 1`** when scenarios share global state.

| Path                            | Holds                                                  |
| ------------------------------- | ------------------------------------------------------ |
| `features/<capability>.feature` | Gherkin scenarios, one file per user-facing capability |
| `features/steps/`               | Step definitions and the shared BDD fixtures           |
| `.features-gen/`                | `bddgen` output, gitignored                            |
<!-- /slot -->

<!-- slot: 14 -->
1. **TanStack specifics?** No new barrel merging a server/client pair
   ([§6](#6-server--client-boundary)); hoisted helpers written as `function`
   declarations ([§5](#5-module-organization)); the error status set by the
   function middleware ([§9](#9-errors-and-middleware)); migrations through
   `db:generate` and `db:migrate`, custom SQL only via `db:generate --custom`
   ([§7.4](#74-migrations)).
<!-- /slot -->

<!-- slot: 12 -->
- **The package manager is pnpm** (`pnpx`, not `npx`); don't mix in npm or yarn.
<!-- /slot -->

<!-- slot: 12.1 -->
- **CI's database is a PostgreSQL service container** at production's major version,
  named inside the test-database family so the guard in [§11](#11-testing) accepts it.
  CI migrates it with `db:migrate` before `test` and `test:e2e`, and each `test:e2e`
  shard gets a container of its own.
- **Versions live in the repository.** Node in `.nvmrc` and pnpm in `package.json`'s
  `packageManager`; CI reads both files and repeats neither version.
- **`test:e2e` shards share one production build.** One CI job builds the app and
  hands the output to the shards, and each shard starts its own server from it.
<!-- /slot -->
