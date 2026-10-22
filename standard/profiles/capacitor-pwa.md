---
name: capacitor-pwa
title: Offline-first PWA with Capacitor
summary: The client of an offline-first app: a Vite React SPA on TanStack Router, installable as a PWA, wrapped by Capacitor, with domain data on the device in Dexie and an optional small server API.
---

<!-- slot: stack -->
Two tiers. The client is the app and runs offline with no account; a server adds to it and
never gates it.

- **Client:** Vite, React 19, TypeScript, TanStack Router (file-based, SPA mode: no TanStack
  Start, no SSR), Tailwind CSS v4, Zod. vite-plugin-pwa makes it installable, and Capacitor
  wraps it as the iOS and Android apps.
- **On-device data:** Dexie over IndexedDB is the source of truth; preferences sit in `localStorage`.
- **Server (optional):** a small API on the same origin at `/api/*`. Its own stack rules or
  the app's local profile cover its secrets, tables, migrations, and status mapping.
- **Tests and tooling:** Vitest on `fake-indexeddb`, Playwright with playwright-bdd;
  Prettier, oxlint, `tsc -b`, pnpm.
<!-- /slot -->

<!-- slot: 0 -->
| Concern                    | Use                                                                                                   | Not                                                                       |
| -------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Routing                    | TanStack Router file routes in `src/routes/`, SPA mode                                                | TanStack Start or SSR loaders; hand-rolled history                        |
| Domain data                | Dexie tables in `src/db/db.ts`, written only through `src/db/repository.ts`, read with `useLiveQuery` | raw IndexedDB; `localStorage` for domain data; a copy held in React state |
| Preferences                | `safeStorage` (`src/lib/safe-storage.ts`), a `localStorage` wrapper that never throws                 | bare `localStorage`, which throws in private mode and sandboxed frames    |
| State shared outside React | a subscribable snapshot (`createStore`, `src/lib/store.ts`) read with `useSyncExternalStore`          | React context for cross-module state; a state library                     |
| Network                    | `fetch` to a same-origin `/api/...` path from a headless `src/lib` module                             | `fetch` in a component; TanStack Query (the device is the cache)          |
| Validation                 | Zod schemas with no `.transform()`                                                                    | `if` checks scattered across components and parsers                       |
| Offline and updates        | vite-plugin-pwa, `registerType: 'prompt'`, `registerSW` started from `src/main.tsx`                   | a hand-written service worker; `autoUpdate`                               |
| Randomness                 | an injected `Rng` from `src/domain/rng.ts` (Web Crypto by default)                                    | `Math.random` in app logic                                                |
| Analytics                  | `capture(event)` from `src/lib/analytics.ts`, the one module that imports the SDK                     | the analytics SDK imported anywhere else                                  |
| Styling                    | Tailwind v4 semantic tokens from `@theme` in `src/styles.css`                                         | palette utilities (`stone-500`); a hex value in a component               |

**The service worker runs in `prompt` mode.** `autoUpdate` reloads every open tab on a
deploy and loses what the user typed. Check for an update on each return to the
foreground, at most hourly. Set `workbox.navigateFallbackDenylist: [/^\/api\//]`, because a
tapped sign-in link is a navigation the fallback would answer with the cached
`index.html`, and add no Workbox runtime route for `/api`, so each call reaches the network.

**Capacitor builds.** The website and the native shell are two builds of one source.

- **The native build writes its own folder.** `build:capacitor` runs
  `tsc -b && vite build --mode capacitor` into `dist-capacitor/`, the `webDir` in
  `capacitor.config.ts`, so `cap sync` (run only after it) never ships the web `dist/`.
- **The native build has no service worker.** The shell serves its assets from the device,
  so the config sets `VitePWA({ disable: mode === 'capacitor' })`.
- **One literal `define`, `__CAPACITOR__`, splits the bundles.** Declared in
  `src/vite-env.d.ts`, it constant-folds, so each build drops the other's branch.
- **The `appId` is permanent once published.** A new one is a different app, and its
  users' on-device data stays behind in the old one.
<!-- /slot -->

<!-- slot: 1 -->
- **Import through the `#/` alias.** It maps to `./src/*` in both the `package.json`
  `imports` field and `tsconfig.json` `paths`.
- **Export named entry points.** A default export appears only where a tool requires one
  (`vite.config.ts`, `capacitor.config.ts`, `playwright.config.ts`).
<!-- /slot -->

<!-- slot: 2 -->
**Prettier is the formatter.** `prettier.config.js` sets
`{ semi: false, singleQuote: true, trailingComma: 'all' }`.

**TypeScript compiles through project references.** One `tsc -b` checks `src/`, the
Node-side configs, and any server package. Every `tsconfig` declares `strict`,
`noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`,
`noUncheckedSideEffectImports`, `verbatimModuleSyntax`, and `erasableSyntaxOnly`.

**oxlint runs the `react`, `typescript`, and `oxc` plugins.** `react/rules-of-hooks` is an
error, and `no-use-before-define` stays off, so the [§5](#5-module-organization) order is legal.

| Script      | Runs                                                              |
| ----------- | ----------------------------------------------------------------- |
| `check`     | `prettier --check .`                                              |
| `lint`      | `oxlint --deny-warnings`                                          |
| `typecheck` | `tsc -b`                                                          |
| `test`      | `vitest run`                                                      |
| `test:e2e`  | `pnpm build && bddgen && playwright test`, against `vite preview` |

`test:e2e` builds first because `vite preview` serves whatever `dist/` holds, and a stale
build passes scenarios against old code.
<!-- /slot -->

<!-- slot: 3 -->
- **Dash (kebab-case) names a module, and PascalCase names a component file.** The module
  is `safe-storage.ts`; `AccountCard.tsx` holds the one component it is named for. A dot
  marks a tool's delimiter: `__root.tsx`, `routeTree.gen.ts` (never edited), `.test.ts`.
- **Three suffixes carry a fixed meaning.** `-controller` is a headless UI flow, a factory
  returning `{ subscribe, getSnapshot, … }`; `-store` is a module-singleton subscribable;
  `-pref` is one device preference. `use*` is reserved for React hooks.
- **Storage keys carry the app's prefix.** `<app>:theme` never collides with a library's
  key on the same origin, and one search finds every key the app owns.
<!-- /slot -->

<!-- slot: 4 -->
The rings of [§6](#6-server--client-boundary) are the top-level folders, and a slice is a
file named for its concept in each ring it touches (`src/domain/project.ts`).

| Folder                                         | Holds                                                                                |
| ---------------------------------------------- | ------------------------------------------------------------------------------------ |
| `src/domain/`                                  | The pure core: domain types, rules, schemas, `rng.ts`, `result.ts`, `app-error.ts`   |
| `src/db/`                                      | `db.ts` (the Dexie schema and version chain), `repository.ts` (the only writer)      |
| `src/lib/`                                     | Headless modules: the store kernel, controllers, prefs, network modules, the backup  |
| `src/hooks/`, `src/components/`, `src/routes/` | Unowned hooks; one component per file; file routes                                   |
| `src/main.tsx`                                 | The composition root: router, service worker, analytics, sync, native wiring         |

- **Imports run toward the core.** `domain` ← `db` ← `lib` ← `hooks` ← `components` ←
  `routes` ← `main`; `db` may import the analytics seam, which imports nothing from `db`.
- **Components never import `db`.** Every write stays on the repository's path.
- **No barrels.** The client and a server package never import each other; the wire
  contract is JSON at `/api/*`.
<!-- /slot -->

<!-- slot: 5.2 -->
`Result` is `{ ok: true; value: T } | { ok: false; error: E }` with `E extends { code: string }`,
defined once in `src/domain/result.ts`, the innermost ring, so every ring can import it.
Return plain literals, and add no Result library. A network module may return one, since
an offline device or a refused request is an ordinary branch for its controller. A Dexie
`rw` transaction rolls back only when its callback throws or rejects, so throw inside it.
<!-- /slot -->

<!-- slot: 6 -->
The server-only rule above binds the optional server tier. The client has four rings, each
with a hard rule about what it may touch, and every module's doc comment names its ring.

**1. The pure core (`src/domain/`).** No DOM, no Dexie, no React, no `import.meta.env`, and
no import from another `src/` folder. Its one platform API is Web Crypto, present in
browsers and Node alike, and randomness arrives as an injected `Rng`. Reason: the core is
unit-tested with no database or browser, and moves to another shell unchanged.

**2. The device (`src/db/`, `src/lib/`).** Dexie, `safeStorage`, and browser APIs behind
guards, because Vitest imports these modules under Node. A module-load side effect checks
`typeof window !== 'undefined'`, and a read of `matchMedia`, `navigator.onLine`, or
`document` sits in a `try`/`catch` with a safe default.

**3. The network (the `src/lib/` modules the app lists).** Only these call `fetch`:

- **Nothing on the core path awaits them.** A sync push is debounced and returns at once,
  and `capture()` never throws. Only a request the user starts (a contact form) awaits.
- **A failure becomes state and a message.** Nothing throws into React; an unsent sync
  marks itself dirty in `safeStorage`, so a reload flushes it on reconnect.
- **Nothing below `lib` imports them.** Account state never gates a Dexie write.
- **One transport module resolves the base URL and credentials.** The web uses a relative
  `/api/...` with `credentials: 'include'`. The native page's origin is
  `capacitor://localhost` or `https://localhost`, so there it returns the absolute origin
  from `.env.capacitor` and a bearer token from native secure storage.

**4. The server (optional, its own package).** Secrets exist only here; its stack rules
carry its boundary, including CORS for the native origins.

**Each bundle carries only its own platform's code.** A module that imports a Capacitor
plugin loads through a dynamic `import()` under `if (__CAPACITOR__)`; the service worker
registration sits under `!__CAPACITOR__`. **Every `VITE_*` variable is public.** Vite
inlines each one the code reads (all of them when code passes `import.meta.env` whole).
<!-- /slot -->

<!-- slot: 7.1 -->
On the device the store holds documents:

- **The domain type is the schema.** A record is a whole aggregate document that embeds
  its owned values, with a `crypto.randomUUID()` id so records from two devices merge.
- **A state is a string union in a `status` field.** IndexedDB cannot index a boolean. A
  timestamp records when (`archivedAt`); the status records whether (`'active' | 'archived'`).
- **An ordered owned collection is an array in its document.** The array order is the order.
- **A unique index skips a record that lacks the field.** `&email` never rejects two
  records that both omit `email`, so make an indexed unique field required.
- **Index only what a query filters or sorts on.** A new embedded field is optional, and
  every reader tolerates its absence, because older documents and backups lack it.
- **Timestamps are epoch milliseconds.** Preferences stay in `safeStorage`, out of the backup.

**The backup is the guarantee against data loss.** The data lives on one device, so
`buildBackup` writes a versioned JSON file of every domain table, and `parseBackup`
validates the whole file with Zod before any write. Import is a merge by id in one `rw`
transaction: it computes the union in memory (the newer `updatedAt` wins), then clears and
bulk-writes, so a failed import leaves the device as it was. Every backup ever exported
still imports, because the import shim keys off each document's shape.
<!-- /slot -->

<!-- slot: 7.2 -->
On the device one module does data access: `src/db/repository.ts`, the only code that
writes Dexie, so every write rule lives in one file and one search finds every writer.

```ts
export async function renameProject(opts: { id: string; name: string }) {
  await db.transaction('rw', db.projects, async () => {
    const project = await db.projects.get(opts.id) // re-read inside the transaction
    if (!project) throw new AppError('NOT_FOUND', PROJECT_MISSING_MESSAGE)
    await db.projects.put(stampUpdated({ ...project, name: cleanName(opts.name) }))
  })
}
```

- **Every write re-reads inside a `rw` transaction.** It writes the whole document back, so
  a fast double tap between a render and its write loses nothing.
- **No `context` argument.** The device has one user, and Dexie joins a nested
  `db.transaction()` to the open one, so neither an owner scope nor a handle travels.
- **Readers are total.** `table.get(id)` may return `undefined`, because IndexedDB enforces
  a primary key's uniqueness; any other lookup returns an array, so a duplicate surfaces.
- **Guards run here even when the UI prevents the state.** An import reaches any state.
- **Every write stamps `updatedAt`, except the backup merge-write.** That repository
  function keeps each record's own value for the merge to compare.
<!-- /slot -->

<!-- slot: 7.3 -->
A device document carries no `version`. IndexedDB never runs two `rw` transactions on the
same table at once, even across tabs, so the re-read inside the transaction is the
compare-and-swap. `updatedAt` orders copies in a backup merge and is never a lock token.
<!-- /slot -->

<!-- slot: 7.4 -->
Dexie has no migration generator: the version chain in `src/db/db.ts` is the ledger, and
Dexie runs it on open.

- **Versions are append-only.** Each table or index change is a new `db.version(n)`; a
  shipped version is never edited, because a device that ran it never runs it again.
- **An `.upgrade()` is idempotent.** It guards on the document's shape, so a fresh install
  skips it. Its test writes old-shaped documents through a throwaway `Dexie` that declares
  the chain only up to the old version, then opens the real `db`.
- **A shape change updates `parseBackup` in the same change.** An old backup is the second
  way into the store.
<!-- /slot -->

<!-- slot: 8 -->
- **Rules, cleaning, and schemas are pure, in `src/domain/`.**
- **App actions are repository functions.** An action re-runs the schema the form ran,
  cleans the input, applies the rule, and writes. It is the only place a rule meets Dexie.
- **A UI flow with phases is a `-controller` factory in `src/lib/`.** Its dependencies are
  injected, so its decisions are unit-tested under Node; a component subscribes and renders.
<!-- /slot -->

<!-- slot: 9 -->
The client has no HTTP edge, so a thrown error ends at the user, through one surface.

- **`AppError` lives in `src/domain/app-error.ts`.** A rule, the repository, and a `lib`
  module throw `new AppError(code, message, { cause })`, whose message is user-facing copy
  from an exported constant.
- **`messageFor(error)` picks the copy.** It returns an `AppError`'s message, and one
  generic line for any other throw.
- **The surface is an inline banner.** A dismissible `role="alert"` at the top of the page
  shows the message and clears on navigation. An error never opens a modal.
- **An action started without `await` catches at its call site.**
  `void save().catch((e) => setError(messageFor(e)))` shows the banner, and the rest of the
  screen keeps working.
- **The root route sets `errorComponent` and `notFoundComponent`.** The error component
  says the on-device data is safe and offers a reload.
<!-- /slot -->

<!-- slot: 10 -->
- **Design phone-first at 390px.** Tap targets are at least 48×48px.
- **Respect the safe areas.** The shell and an installed PWA draw under the status bar, so
  `index.html` sets `viewport-fit=cover` and fixed bars pad with `env(safe-area-inset-*)`.
- **The theme applies before first paint.** An inline script in `index.html` stamps the
  stored choice as `data-theme` on `<html>`; dark tokens sit under both
  `prefers-color-scheme: dark` and `[data-theme="dark"]`. The native status bar follows it.
- **Android's hardware back walks the router history.** At the first entry it exits the app.
<!-- /slot -->

<!-- slot: 11 -->
- **The shipping engine on the device is IndexedDB, so device modules run on
  `fake-indexeddb`.** It implements the IndexedDB spec under Node, and Dexie runs its real
  code over it, so a unit test exercises real indexes, transactions, and upgrades; the E2E
  suite then runs the browser's own IndexedDB. A file starts with
  `import 'fake-indexeddb/auto'` and clears its tables in `beforeEach`. Never mock Dexie or
  the repository. The core's PostgreSQL rule binds the optional server tier.
- **The pure core runs on a scripted `Rng`.** `seqRng([0, 0.5])` rigs each draw.
- **A round-trip test guards the backup.** It fills every table, exports, clears, imports,
  and deep-equals, and a fixture file from each shipped backup version still imports.
- **Fake only the true boundary.** A sync factory gets a fake `fetch` and reads the real
  Dexie; `vi.mock` is reserved for the analytics seam.
- **Ports derive from the worktree.** `vite.config.ts` hashes its name into the app's port
  range for `server.port` and `preview.port`, with `strictPort: true`, and
  `playwright.config.ts` computes the same value.
<!-- /slot -->

<!-- slot: 11.1 -->
- **Every phone project uses `e2e/phone.ts`.** It sets Chromium at 390×844,
  `deviceScaleFactor: 2`, `isMobile`, and `hasTouch`, after spreading the device
  descriptor, because Playwright merges a project's `use` key by key.
- **Scenarios run against `vite preview`.** The config's `webServer` starts it, so the
  service worker is real and an offline scenario (`context.setOffline(true)` once
  `navigator.serviceWorker.ready` resolves) tests the real cache. Each scenario's fresh
  browser context starts with an empty IndexedDB.
- **Locate by role and accessible name.** `getByRole('button', { name: 'Save' })` also
  proves the control is labelled.
- **Exclude `@pending` at generation.** Set `defineBddConfig({ tags: 'not @pending', … })`,
  and keep the default `missingSteps: 'fail-on-gen'`.
- **Stub `/api` in the browser when a scenario must not reach a server.** `vite preview`
  inherits `server.proxy`, so a call let through can write to a local server's database.
  A `Before` hook's `context.route('/api/**', …)` aborts and records each call, an `After`
  hook fails the scenario on any record, and a step answers an endpoint with `page.route()`,
  which Playwright tries first.
- **Native-only behavior has no Playwright lane.** Its decision is a pure function under
  unit test, and the app's local profile lists each such behavior as uncovered.

Paths: `e2e/features/<capability>.feature`, `e2e/steps/` (with the `/api` guard),
`e2e/fixtures/`, and the gitignored `bddgen` output in `.features-gen/`.
<!-- /slot -->

<!-- slot: 12 -->
- **The package manager is pnpm.** Use `pnpx` for one-off binaries.
- **Pin every `@capacitor/*` package to one exact version, and move them together.** The
  native projects and the JavaScript bridge must agree.
- **Commit `android/` and `ios/`.** They hold signing, permissions, and the icons
  `@capacitor/assets` generates; their build output and the assets `cap sync` copies in
  stay gitignored.
<!-- /slot -->

<!-- slot: 14 -->
1. **Offline-first specifics?** The client works offline with no account; `src/domain/`
   imports nothing outside itself; no network module sits below `lib` or on the core path;
   native-only code loads under `__CAPACITOR__`; no `VITE_*` secret
   ([§6](#6-server--client-boundary)). Writes go through the repository in a `rw`
   transaction, new fields are optional, an index change appends a `db.version`, and every
   older backup imports ([§7.1](#71-schema-and-data-modeling), [§7.4](#74-migrations)).
<!-- /slot -->
