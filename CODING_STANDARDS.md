<!-- Built from standard/core.md + standard/profiles/tanstack-start.md by
     scripts/build.mjs. Edit those files, not this one. -->

# Coding standards

The Arcnovus coding standard, in two layers. The **core** holds the rules that apply
on every stack: how a project's records age, how modules read, how functions take
and return values, how data is modeled, how failures surface, how behavior is tested,
and when a change is done. A **stack profile** holds the mechanics for one stack: its
toolchain, its framework's primitives, its file layout. A project's copy of this file
is generated from the core plus the profiles that project uses, so the copy you are
reading is the whole standard for this project. Every rule states its mechanism and
its reason inline, with an example where one helps.

Where a section carries stack rules, they follow the core rule under the same section
number, so a section number means the same thing in every project.

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

This copy is assembled for the stack below. The core rules carry to any stack; the
stack rules under each section are specific to it.

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
state, forms, validation, routing, auth, HTTP calls, serialization, dates, command-line
parsing — use the primitive your framework or your language's established ecosystem
already provides. Reinventing a framework primitive is a defect, not a matter of
taste. An opinionated framework has a canonical way to do each of these; find it and
follow it.

If the right library isn't installed, propose adding it rather than hand-rolling a
substitute. If a bespoke mechanism is genuinely needed, state why the idiomatic
one doesn't fit before building it.

Why: one canonical way per concern means every part of the app reads the same, and a
fix in the primitive reaches every caller.

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

---

## 1. Language and imports

- **The strictest type checking the language offers, always.** The configuration is
  in [§2](#2-formatting-lint-and-types-automated). Code that needs a strictness
  setting switched off is a design smell, not a config problem.
- **Import through a stable path from the project root** instead of deep relative
  chains (`../../..`). Reserve relative imports for siblings inside the same slice.
- **Name your exports.** A module's public entry points are named, so the import
  name is stable and greppable, and the module states which names are its public
  API.

- **TypeScript with `strict` on, always.** The full strict configuration is in
  [§2](#2-formatting-lint-and-types-automated).
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

---

## 2. Formatting, lint, and types (automated)

These are machine-enforced. **Do not flag them in review** — run the command.

**The gate.** Every project wires the same five steps under the same names, so
people, agents, and CI call them the same way on every stack. The first four must
pass on every commit. `test:e2e` takes longer and must pass before a change is
complete ([§11.1](#111-end-to-end-coverage)).

| Step        | Runs                                  |
| ----------- | ------------------------------------- |
| `check`     | the formatter, in check mode          |
| `lint`      | the linter, warnings as errors        |
| `typecheck` | the type checker or compiler          |
| `test`      | the unit/integration suite            |
| `test:e2e`  | the end-to-end suite                  |

The stack rules below name the tool behind each step and how it is invoked: a
package script, a Gradle task, a cargo or uv command. A step the toolchain folds into
another (a compiler that type-checks as it builds) keeps its name and runs the
folded command.

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

---

## 3. Naming

- **Follow the language's naming conventions** for files, modules, types, and
  functions. The stack rules below state them.
- **The service wears no role-tag — the bare slice name _is_ the service.** Every
  other layer in a slice carries a layer suffix
  ([§4](#4-project-structure)), so the unmarked module is the unambiguous front
  door: the slice's only entry point
  ([§8](#8-domain--service-layer-and-validation)). Add no `service` tag in either
  position; the _absence_ of a suffix is the signal that says "this is the front
  door."
- **Identifiers reveal intent.** A function, variable, or type whose name doesn't
  say what it does or holds is a [Mysterious Name](#13-code-smell-baseline). Rename
  it; if no honest name comes, the design underneath is murky.

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

---

## 4. Project structure

**One folder per slice; the name carries the layer.** A slice is one bounded concern
— an aggregate (`order`, `invoice`), a feature or process (`export`, `ingestion`),
or a value concept (`money`). Everything about it lives in its folder (or package,
or module), named for its entity in the singular using the project's own domain
vocabulary — the word the glossary already uses. A slice that names a process, not
an entity, is exempt from the singular rule. Inside a slice, each layer has a fixed
name, so a reader knows what a file is before opening it; the stack rules below give
the layer names.

- **A satellite earns its file.** A pure rule with one consumer folds into that
  consumer, its unit test keeping its own file and importing the host module. Split
  a satellite out only when folding would cost a fast pure test or collapse a
  deliberate boundary.
- **Tests sit beside their module, or mirror its path where the toolchain expects a
  separate test tree**, named after it.
- **Cross-cutting code that no slice owns has fixed homes**, listed in the stack
  rules below. Move a module out of a shared home the moment it gains a single owning
  slice.

**Dependency direction is a design constraint.** Slices depend downward toward
shared kernels; a composition root (the auth singleton) may import the slices it
wires, but slices do not cycle through each other. Two slices importing each other
at runtime means one is misfiled.

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

---

## 5. Module organization

**Read top-down: exports first, helpers beneath, leaves last.** Choose the order
that puts a module's purpose before its mechanism.

A module opens with its doc comment, then its **exported entry points, highest
level first**, then each helper **directly beneath the function that first calls
it**, down to leaf helpers at the foot. A reader moving top to bottom meets what
the module does before how it does it.

- **Every module opens with a doc comment** stating what it does, and — for a
  server-only module — its boundary.
- **Scope.** This governs modules that carry logic (service, data-access, and
  library layers). UI component files keep their framework's component-first idiom,
  which is already top-down. Test files are exempt.

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

- **Every module opens with a `/** … */` doc comment.**
- **Hoist with `function` declarations.** A helper that sits above its first caller
  must be a `function` declaration (hoisted and callable before its own line), not
  a `const` arrow (which lives in a temporal dead zone and throws if called
  before its line runs).
- **`const` data respects the temporal dead zone.** Read a `const` lookup table or
  separator only from inside a function body (deferred to call time), or place it
  above any top-level code that reads it. Types are erased and carry no ordering
  constraint.
- **Scope.** Component files keep their component-first idiom.

### 5.1 Function signatures

**Prefer one named-argument form over positional parameters in the code you
write.** A named argument reads at the call site without counting arguments, takes a
new field without reordering every caller, and matches the shapes already in this
standard: the service's `placeOrder({ context, input })`
([§5](#5-module-organization)) and the data-access `{ context, query }`
([§7.2](#72-data-access-modules-repositories)). The form is the language's own: an
options object, keyword-only parameters, or named arguments, as the stack rules
below say. This governs any function you author — service, data-access, library,
and client-side utilities alike. The one exception is a signature a framework
already owns (below).

- **A single, obvious argument stays positional.** One well-named parameter is
  already self-documenting, so wrapping it earns nothing: `cleanOrder(input)` stays
  `cleanOrder(input)`. Reach for the named form at the second parameter — or at the
  first when a boolean or another field is already coming. The data-access layer is
  stricter and always takes the named form, even for a lone criterion
  ([§7.2](#72-data-access-modules-repositories)).
- **A framework-owned signature follows the framework, never this rule.** Where a
  framework hands your function its arguments (a request handler, a component, a
  hook, a route loader, a middleware, an event callback), use the shape it passes;
  the first principle ([§0](#0-first-principle-idiomatic-stack-first)) decides the
  tie. This is not a server/client split; it's about who owns the signature.

Why: one call convention across the code you write means a reader learns argument
shapes once; deferring to the framework where it owns the signature keeps the code
reading as idiomatic for its framework, not a house dialect layered on top.

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

### 5.2 Return values

**Return a named object when a function has more than one thing to report.** The
caller reads each field by name, and a new field breaks no existing caller. Never
return a tuple or positional array from a function you write. A single obvious
value stays bare: a finder returns its collection, a predicate returns its boolean.
Framework-owned shapes keep their own idiom ([§5.1](#51-function-signatures)).

**Return a `Result` when failure is an ordinary branch the direct caller handles.**
A thrown failure is invisible in a function's signature. A `Result` puts each
failure in the return type, and the caller narrows on the failure's `code`, so the
data a failure carries is typed where it is handled. Use it for:

- **Classifying functions** that sort an input into one of several expected
  outcomes: a parse, a match, or a lookup whose "no match" or "ambiguous" is a normal
  answer.
- **Batch work** with per-item outcomes, so a rejected item is recorded and the
  batch continues.
- **A service call the caller recovers from** by falling back, retrying with other
  input, or recording the failure and moving on.

The project defines one `Result` shape, `ok` with a value or a failure with a
`code`, and each function declares its own failure union with whatever data the
caller needs to act on. The stack rules below give the shape.

**Everywhere else, throw.** A `Result` stops at the direct caller:

- **A failure that ends the request throws the app error**
  ([§9](#9-errors-and-middleware)). If the caller's only move on a failed `Result`
  would be to throw, throw at the source.
- **A transport edge never returns a `Result`.** A server function, RPC, or HTTP
  handler that receives a failed `Result` throws the app error for it, so the
  client's cache, the router's error boundary, and the error mapping all see a
  failure.
- **A transaction aborts by throwing.** A transaction rolls back only when its
  callback throws, so work inside a transaction that returns a failed `Result`
  commits whatever it already wrote. Throw inside the transaction, and build the
  `Result` outside it when the caller needs one.
- **Data-access modules keep [§7.2](#72-data-access-modules-repositories).**
  Readers are total and writers throw, so a data-access function never returns a
  `Result`; the service classifies what a reader returned.
- **Unexpected failures still throw.** A dropped connection or a bug propagates as
  a throw. Never wrap arbitrary code in a catch-all to turn every error into a
  `Result`.

In a language without exceptions, "throw" means returning the project's error type
and propagating it unchanged to the edge; the stack rules below say how.

Why: a `Result` makes a failure part of the contract where the caller acts on it,
and throwing everywhere else keeps the app on the error path that its framework and
the error mapping already handle.

React hooks and other framework-owned shapes keep their own idiom.

```ts
// ✗ a tuple: the caller has to remember which slot is which
return [order, true]

// ✓ a named object
return { order, operation: 'insert' }
```

TypeScript has no checked exceptions, so the codes a function can throw are
invisible in its signature. Zod's `safeParse` is the model for a `Result`. Define
the type once, client-safe, in `src/lib/result.ts`:

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

- **A server function never returns a `Result`.** TanStack Query caches
  `{ ok: false }` as a successful response, the router's `errorComponent` never sees
  it, and the [§9](#9-errors-and-middleware) middleware maps no status.
- **Drizzle rolls back only when the transaction callback throws**, so work inside
  `inTransaction` that returns `{ ok: false }` commits whatever it already wrote.
- **Data-access modules never return a `Result`**: the service classifies what a
  reader returned, as `matchOrder` does above.
- **Never wrap arbitrary code in `try/catch`** to turn every error into a `Result`.

---

## 6. Server / client boundary

**Server-only code and secrets never reach a client.** A module that holds
credentials, secrets, or a database connection is server-only. It never shares a
file with code a client imports, and it fails loudly if it is ever loaded on the
client, so a misplaced import breaks the build instead of shipping a secret. A
component with no client of its own (an internal service, a CLI) has no such
boundary.

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

---

## 7. Data layer

### 7.1 Schema and data modeling

Model so that invalid states can't be represented.

- **No boolean columns.** A boolean can't grow a third state and usually flattens
  richer information into yes/no. Reach for:
  - an **enum / status** for a closed set of states — whether something happened or
    what state it's in (deleted, verified, published). Make the state explicit;
    don't infer it. Split enums so no table can hold a value that is meaningless for
    it.
  - an **ordinal `position`** for "which is primary / what order" (below).
  - a **nullable foreign key** for "the chosen one" among children.
- **A nullable timestamp is not a boolean substitute.** `deleted_at IS NULL` hides a
  two-valued flag in a temporal column and conflates "hasn't happened" with "time
  unknown", and it inherits every timestamp hazard (see [§7.3](#73-optimistic-locking)).
  A timestamp records _when_ an event happened; _whether_ it happened is state — an
  enum. When both matter, that's two columns.
- **Ordered owned collections use an ordinal `position`**: a non-null `smallint`
  plus a unique constraint on `(parent_id, position)`. Primary is the lowest
  position; the same column carries display order; no `is_primary` flag. Assign
  `position` from array order at write time — the parent's data-access module owns
  it.
- **Uniqueness spanning nullable columns must be `NULLS NOT DISTINCT`** (Postgres
  15+). By default `null ≠ null`, so two otherwise-identical rows that share a
  `null` both slip through:

  ```sql
  UNIQUE NULLS NOT DISTINCT (order_id, sku, variant)
  ```

In Drizzle: a status is a `pgEnum`; the ordinal is
`position: smallint('position').notNull()` plus `unique(parentId, position)`; and a
nullable unique constraint is

```ts
unique('order_line_uq').on(t.orderId, t.sku, t.variant).nullsNotDistinct()
```

### 7.2 Data-access modules (repositories)

Data access lives in server-only data-access modules: plain functions over the ORM
or driver, free of business rules.

- **One module per aggregate**, exporting plain functions that own the SQL, so
  callers — server functions, route loaders, handlers — never hand-write queries.
- **One argument holding `context` and `query`; no positional params.** Every
  exported function takes a single argument with up to two parts:
  - **`context`** carries cross-cutting concerns. The transaction is its only
    optional field: an enlist-or-open transaction, so several calls compose
    atomically. When the module scopes rows by owner (below), that owner scope is a
    required field of a required `context`; a module with no such scope can leave
    `context` itself optional.
  - **`query`** holds the call's own parameters, always as one named value: the
    lookup criteria (`{ email }`) or the write payload
    (`{ id, expectedVersion, input }`).
- **Owner scope is a required, closed value on `context`, and fails closed by
  construction.** When rows belong to owners and a caller may see only its own, the
  scope travels as a required field of a required `context`, typed as a closed union
  with no unset state: `{ kind: 'owner'; ownerId } | { kind: 'all' }`, the `all` case
  reserved for a caller the service has cleared to cross owners. Omitting the scope
  fails the type check, and the `WHERE` clause is exhaustive over the union, so a
  value that defeats the types matches no rows. Every read and write that could cross
  owners applies it, the finders included, so a new query cannot leak across owners
  by forgetting a filter. The scope is a value the service decides from the caller's
  permission; the module applies the clause and never sees a role. Create takes its
  owner from `context` the same way ([§8](#8-domain--service-layer-and-validation)).
- **Server-only.** A data-access module holds the database connection, so it sits
  behind the transport edge and is never imported by client code
  ([§6](#6-server--client-boundary)).
- **No business rules here.** An invariant that can't be a database constraint
  belongs to the service layer above ([§8](#8-domain--service-layer-and-validation)).
  This layer does data, not policy.
- **Reads are total; only writers throw.** A finder returns a collection and never
  throws — no match is an empty collection, not an error. Even a by-id lookup
  returns a collection, so a should-be-impossible duplicate surfaces instead of
  being masked by "take the first". Deletes are idempotent (deleting an absent row
  is a no-op). Writers raise only for structural reasons — an optimistic-lock
  conflict, or not-found when the caller named a specific row to change — as app
  error codes ([§9](#9-errors-and-middleware)).
- **Aggregate writes are transactional**, and on update **replace owned child
  collections wholesale** (delete + re-insert with fresh ordinals) rather than
  reconciling in place. Child rows are value objects with no identity worth
  preserving, and re-inserting sidesteps the in-place-reorder hazard from
  [§7.1](#71-schema-and-data-modeling).

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

A data-access module imports the DB client (driver and connection secrets), so it
sits behind a server-function handler and is never imported by a client component.
Writers raise `AppError` codes.

### 7.3 Optimistic locking

Guard full-record updates with a `version` integer and a compare-and-swap, never
with a timestamp.

- **A table that accepts full-record updates carries a lock column:** a non-null
  `integer` `version`, default `0`.
- **The update is a compare-and-swap.** The caller passes the `version` it last
  read; one statement checks it and bumps it:

  ```sql
  UPDATE "order"
  SET <fields>, version = version + 1
  WHERE id = $1 AND version = $2
  RETURNING id
  ```

  No row back means someone else won the race, or the row is gone: `CONFLICT` (409)
  or `NOT_FOUND`. Because the compare and the increment are one statement,
  concurrent updates can't interleave: exactly one racer's `UPDATE` matches.

- **Increment in SQL, never in app code.** A read-modify-write
  (`version: justRead + 1`) reintroduces the race.
- **Never use `updated_at` — or any timestamp — as the lock token.** Postgres
  timestamps store microseconds; a client-side date type that holds less (JavaScript's
  `Date` holds milliseconds) round-trips to a different value, so
  `WHERE updated_at = <the value you read>` matches zero rows and every update
  spuriously conflicts. A monotonic integer has no precision, timezone, or
  round-trip hazard.

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

### 7.4 Migrations

**Migrations are generated from the schema, never hand-written.** Change the schema
definition, then let the migration tool diff it and emit the SQL. Commit the
generated migration and its metadata, but treat them as build output — do not
hand-edit them. Editing the emitted SQL, or dropping in a loose migration file,
desyncs the snapshot the tool diffs against, so the next generation produces a
corrupt or duplicated diff. The schema is the source of truth; the migration is its
compiled artifact.

**Reach for hand-written SQL only when the schema DSL genuinely can't express the
change** — a data backfill, an index built `CONCURRENTLY`, a constraint or trigger
the schema DSL has no builder for. Even then, keep it inside the ledger: generate an
empty, tracked migration with the tool and write the SQL into that file, so the
journal stays ordered and the migration replays everywhere. A raw statement run
straight against a database, outside a generated migration, is off the table — it
leaves every other environment behind and can't be replayed.

**Run the migration tool only through a named script; never call it directly.** Wrap
every schema operation in a named script (`db:generate`, `db:migrate`, …) and always
go through it. The script name is the stable interface; the command and its flags,
env loading, and ordering behind it are free to change in one place and every caller
(people, agents, CI) picks it up. This applies to agents too.

The schema lives in `src/db/`, and Drizzle Kit is the migration tool: `db:generate`
writes the timestamped migration together with its snapshot and journal entry, and
`db:migrate` applies the pending files. Commit the generated `.sql` and the `meta/`
snapshot. For SQL the schema DSL can't express, generate an empty, tracked migration
with `pnpm db:generate --custom`. Go through the package scripts (`db:generate`,
`db:migrate`, `db:push`, `db:studio`, …), never the bare CLI, `pnpm exec`, or
`pnpm dlx`.

---

## 8. Domain / service layer and validation

The service layer sits between the edge (server functions, handlers, forms) and the
data-access layer, and owns the rules neither of them can.

- **The service is a deep, self-sufficient module.** Callers go through the service
  (`placeOrder`, `updateOrder`), never straight to a data-access function, so its
  rules can't be bypassed. The service alone guarantees a cleaned, normalized,
  rule-checked, owner-stamped result regardless of caller — which is why the
  integration tests call the service, not the HTTP edge ([§11](#11-testing)).
- **Validators are pure, lenient, and shared.** Write one validation schema that
  does not transform its input, so its input and output types coincide and the
  single schema serves both the transport edge's validator and the form. Validate
  the **normalized** form so the schema accepts what a human types — judge the
  trimmed, lowercased value, but return the raw string. A strict schema over the raw
  value (an email check on `" ada@x.com "`) rejects input a later clean would happily
  accept, leaking a normalization requirement onto the form and the user.
- **Cleaning and normalization live in the service, not the schema.** Trimming,
  empty-to-null, case-folding, and any identity keys your unique indexes compare
  stay in the service — its single home for folding. The overlap between the
  schema's lenient check and the service's clean is deliberate defense-in-depth,
  and it is safe **only because the operations are idempotent**. A non-idempotent
  normalization must never be duplicated across the two layers this way.
- **Stamp the owner from context, never the payload.** The input type carries no
  owner id; the service takes it from the session on `context`. A client can't
  assign ownership by editing its request.
- **Uniqueness is a service pre-check plus a database index, never an async schema
  refine.** A check-then-insert probe is a time-of-check/time-of-use race; only the
  unique index actually enforces dedup. The pre-check exists for a friendly error;
  the index is the guarantee.
- **Name a write-type for the boundary it serves.** A write-type family crosses the
  layers above in a fixed progression, and its names say so — the concept leads, a
  boundary suffix states where the type sits, so a reader knows a type's role
  without opening the module:

  **`*Payload` → `*Draft` → `*Write` / `*Insert` → `*Aggregate`**

  `*Payload` is untrusted wire input and carries no owner id or derived column, so a
  leak into the wire shape is obvious on sight; `*Draft` is the service's
  clean-and-fold seam; `*Insert` is one table's row and `*Write` is the whole
  aggregate; `*Aggregate` is the fully loaded read model. Keep schema **values**
  unsuffixed (`orderCreateSchema`); only the types carry the suffix. Form
  (`*FormValues`) and helper types (a projection, the identity fold, query criteria)
  keep their names.

Where each concern lives:

| Concern                                                                | Home                                                          | Authority    |
| ---------------------------------------------------------------------- | ------------------------------------------------------------- | ------------ |
| Shape + format (lenient)                                               | the shared schema, run at the transport edge and the form     | the schema   |
| Cleaning (trim, empty→null, case-normalize)                            | the service                                                   | the service  |
| Identity normalization (the keys unique indexes compare)               | the service (single home for folding)                         | the service  |
| Cross-field domain rule (e.g. "an order needs at least one line item") | the service                                                   | the service  |
| Uniqueness                                                             | service pre-check (friendly error) + DB unique index          | the DB index |

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

---

## 9. Errors and middleware

Deliberate failures that end a request are thrown as a typed app error carrying a
machine-readable code; one global handler maps the code to an HTTP status.

- **Throw the app error with a code for every expected failure that ends the
  request.** A failure the direct caller handles as an ordinary branch is returned
  as a `Result` instead ([§5.2](#52-return-values)). The **code** is the contract —
  the rest of the system branches on `code`; the message is for humans. Wrap an
  underlying error as the app error's cause.

  | Code                | Meaning                                              |
  | ------------------- | ---------------------------------------------------- |
  | `UNKNOWN`           | no more specific reason — the 422 catch-all          |
  | `VALIDATION`        | well-formed input that breaks a domain rule          |
  | `NOT_FOUND`         | the named thing doesn't exist                        |
  | `NOT_AUTHENTICATED` | no valid session                                     |
  | `FORBIDDEN`         | authenticated, but the role lacks the permission     |
  | `CONFLICT`          | the write conflicts with existing state              |

- **An app error is always 4xx.** It means the server worked and is telling the
  caller what was wrong. A 5xx is reserved for any other throw (a real failure),
  which the mapping leaves untouched. Unmapped codes fall back to 422.

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

- **Map codes to statuses in one place.** One global error handler at the edge turns
  an app error into its status. Domain code never names an HTTP status, and no
  handler maps errors by hand.
- **Cross-cutting request concerns are global middleware**, registered once at the
  app entry point, not repeated in each handler: CSRF, request logging, tracing,
  error mapping.

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
- **Never mock the database or substitute an in-memory shim** (such as PGLite or
  SQLite). Run against the same engine you ship on (PostgreSQL), so tests exercise
  real constraints, types, and transactions.
- **Assert external behavior through a module's exported API**, at the highest
  existing seam — the service for an aggregate — never private internals or the
  order of declarations inside a file. A refactor that preserves behavior must not
  require a test change.
- **Isolate parallel work without hardcoding.** Derive the dev-server port and the
  test-database name deterministically from the worktree's identity (for example, a
  hash of its path), so many worktrees or checkouts run at once without collision.
  Never hardcode a port or pass `--port`, and never point a test at the dev
  database.

### 11.1 End-to-end coverage

**Every user-observable behavior is specified in a Gherkin `.feature` file and
exercised end to end through the interface the user touches.** A behavior is
user-observable when a user can see it or cause it through the running app: a page
or flow, a validation message, an error or empty state, a permission denial, a
redirect, an email or file the app sends, a command's output and exit status. The
feature file is the specification of that behavior. The scenario, run against the
real server and an isolated database, is the evidence that it works.

- **A web UI is exercised in a real browser through playwright-bdd.**
- **A command-line tool is exercised by running its built binary**, with the runner
  the stack rules name.
- **A component with no interface of its own** (an internal service, a worker, a
  library) reaches users through an app, so that app's scenarios cover what users
  can observe. The component's own tests follow its stack rules.

**A change is complete only when its behavior is in a feature file and the scenario
passes.** Unit tests, integration tests, and a manual check do not meet this bar on
their own. Each kind of change updates the feature files in the same change set:

- **A new feature** adds the scenarios that describe it.
- **A change to existing behavior** edits the scenarios that describe it.
- **A fix for a bug a user can hit** adds or corrects a scenario that fails before
  the fix and passes after it.
- **A removal** deletes the scenarios for the removed behavior.
- **A refactor** that preserves behavior leaves the feature files as they are, and
  the passing suite is its evidence.

**The full suite passes before a change is complete.** A change can break a
scenario in another feature, so `test:e2e` runs every scenario before merge. A CI
stage may run a tagged subset (`@smoke`) to keep the deploy fast. The full run
before merge still applies.

**A skipped scenario covers nothing.** A scenario tagged `@skip` or `@fixme`, or one
with an undefined step, does not count as coverage. A change that skips a scenario
to get the suite green is incomplete. Configure the runner so an undefined step fails
the run.

**`@pending` marks a scenario written ahead of its code.** A scenario for behavior
the app does not have yet may sit in a feature file tagged `@pending`. Exclude the
tag where the runner selects scenarios, so its undefined steps do not fail the run.
A `@pending` scenario is a specification and counts as coverage for nothing. The
change that builds the behavior removes the tag, and that change is complete only
when the scenario runs and passes. A scenario for behavior the app already ships
never carries `@pending`, and no other tag may exclude a scenario from the full run.

**Write steps in the domain's language, at the level of user intent.** A step
states what the user does and sees in the glossary's vocabulary:
`When the Operator places an order for 3 widgets`, never `When I click "#submit"`.
Selectors, URLs, and waits belong in the step definitions, so a UI redesign changes
the step definitions and leaves the feature file as written.

**Each distinct outcome a user can see gets a scenario, and the inputs behind one
outcome stay in unit tests.** A scenario proves the behavior is wired through the
interface, the transport edge, the service, and the database. One scenario shows
that an invalid email reaches the user as a field error, and the validator's unit
test covers each malformed shape that produces it. Use a `Scenario Outline` when the
variations are themselves visible to the user, such as a different message per
role.

**Run serially when scenarios share state.** Run scenarios one at a time when they
share global state, and tag every record a scenario creates with a recognizable
marker so a teardown step can sweep it from the reused E2E database.

Why: a feature file states what the app does in words a user and a reviewer can
check, and a passing scenario shows the app doing it with every layer wired
together. Making both part of done means the specification is updated in the same
change as the code it describes.

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

---

## 12. Version control and workflow

- **One package manager per language, used consistently.** The stack rules below
  name it. Don't mix in another, whose lockfile and install behavior diverge.
- **Work on a feature branch; only the production merge needs a human.** An
  automated contributor may commit and push to its own feature branch without being
  asked. Merging into the **production-aligned branch** of an externally deployed app
  requires explicit human approval that names that branch. The production-aligned
  branch is the one whose every push deploys production: `prod` where the app runs
  `main` as its trunk and `prod` as its release branch, or the default branch itself
  where that branch deploys production. Every other merge needs no approval: into a
  branch that does not deploy production, in an app that runs only locally, or one
  that stays in a local checkout. A request to merge that names no branch means a
  non-production target. Never commit directly to the default branch or the
  production-aligned branch.
- **Never bypass hooks** (`--no-verify`), and never rewrite already-shared history:
  no amend, rebase, or force-push on the default branch, the production-aligned
  branch, or a branch someone else is building on.
- **Every commit leaves the automated gate green.** `check`, `lint`, `typecheck`,
  and `test` pass ([§2](#2-formatting-lint-and-types-automated)). A change is not
  ready to merge until its behavior is in a feature file and the full `test:e2e`
  suite passes ([§11.1](#111-end-to-end-coverage)).
- **Record cross-cutting decisions as ADRs** in the repository, so the reasoning is
  durable and these standards and the code stay consistent as the app grows.

- **The package manager is pnpm** (`pnpx`, not `npx`); don't mix in npm or yarn.

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
3. **Boundary intact?** No server-only code or secret reachable from a client
   ([§6](#6-server--client-boundary)).
4. **Data rules?** No boolean columns, no timestamp-as-flag, an ordinal `position`
   for ordered collections, `NULLS NOT DISTINCT` on nullable unique constraints
   ([§7.1](#71-schema-and-data-modeling)).
5. **Data-access shape?** One `{ context, query }` argument, total non-throwing
   readers, idempotent deletes, transactional aggregate writes, no business rules in
   the layer ([§7.2](#72-data-access-modules-repositories)).
6. **Locking?** A `version` compare-and-swap incremented in SQL; no timestamp lock
   token ([§7.3](#73-optimistic-locking)).
7. **Migrations generated?** The schema change was compiled to a migration through
   the named script; the generated SQL and its metadata are committed but not
   hand-edited; raw SQL only through a tracked custom migration
   ([§7.4](#74-migrations)).
8. **Errors?** Expected failures that end the request are app error codes, always
   4xx, with the status set in one place ([§9](#9-errors-and-middleware)). A `Result`
   appears only where the direct caller branches on the failure, and is never
   returned from a transport edge or a data-access module, nor used to abort a
   transaction ([§5.2](#52-return-values)).
9. **Validation home?** A lenient pure validator shared with the form; cleaning and
   normalization owned by the service; owner from context, not payload
   ([§8](#8-domain--service-layer-and-validation)).
10. **Module order, signatures & returns?** Doc comment, then exports, then helpers
    stepping down; the named-argument form for any multi-argument function you
    write, deferring to framework-owned signatures; a named object for a multi-value
    return, never a tuple ([§5](#5-module-organization)).
11. **Tests at the right seam?** Behavior through the exported API against an
    isolated test database, not internals ([§11](#11-testing)).
12. **Behavior covered end to end?** Every user-observable behavior the diff adds,
    changes, or fixes appears in a `.feature` scenario written in domain language.
    Removed behavior has had its scenarios deleted, no scenario is skipped, only
    unbuilt behavior carries `@pending`, and the full `test:e2e` suite passes
    ([§11.1](#111-end-to-end-coverage)).
13. **TanStack specifics?** No new barrel merging a server/client pair
   ([§6](#6-server--client-boundary)); hoisted helpers written as `function`
   declarations ([§5](#5-module-organization)); the error status set by the
   function middleware ([§9](#9-errors-and-middleware)); migrations through
   `db:generate` and `db:migrate`, custom SQL only via `db:generate --custom`
   ([§7.4](#74-migrations)).
14. **Smell pass** — walk [§13](#13-code-smell-baseline) and flag findings as
    judgement calls, not hard violations.
