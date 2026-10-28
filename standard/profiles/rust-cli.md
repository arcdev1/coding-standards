---
name: rust-cli
title: Rust command-line tool
summary: A Rust binary that people and agents run from a shell, on Cargo and std, with cargo-deny, rustfmt, clippy, cargo test and Gherkin features run against the built binary.
---

<!-- slot: stack -->
- **Language and build:** Rust, edition 2024, std first; Cargo, with `Cargo.lock` committed.
- **Tooling:** rustfmt and clippy at their defaults; cargo-deny and a publish-age cooldown.
- **Data:** PostgreSQL through `psql`, `createdb` and `dropdb`; state in flat files.
- **Tests:** `cargo test` (inline unit tests, integration tests against the built binary)
  and Gherkin features run by an in-repo step runner.
- **Interface:** binaries that people and agents run from a shell.
<!-- /slot -->

<!-- slot: 0 -->
**std is the first primitive.** Reach for a crate only for a concern std has no
primitive for. A crate's build script and proc macros run on the build machine with an
install script's privileges, so every crate, dev-dependencies included, passes
`cargo deny check` (named in `deny.toml`'s `[bans] allow` list, no build script,
crates.io as the only source), resolves under cargo's 3-day cooldown
(`[registry] global-min-publish-age = "3 days"`), has its source read before it is
added, and lands in one commit with its allow-list entry and an ADR.

Where std has no primitive, the core rule holds and the established crate is the
primitive. The ADR is the core's proposal and its decision in one record, naming the
concern, the crate, what it pulls in, and the std-only alternative. An ADR that chooses
to hand-roll states why the crate does not fit (the `url` crate pulls in idna and the
ICU4X Unicode crates for one path swap). Subprocesses run through `std::process::Command`
with each argument its own `arg`, file locks use `std::fs::File::lock` (Rust 1.89), and
arguments go through one parser, chosen by ADR, that yields a typed request per command.
<!-- /slot -->

<!-- slot: 1 -->
- **`rust-version` is the oldest toolchain the code builds on.** Clippy's
  `incompatible_msrv` lint flags any std API stabilized after it.
- **Silence a lint only with `#[expect(lint, reason = "...")]`** on the narrowest item.
  `expect` fails once the lint stops firing, so a suppression cannot outlive its cause.
- **Every `unsafe` block carries a `// SAFETY:` comment** stating why it is sound.
- **Import through `crate::` paths.** The one glob import is `use super::*` in
  `mod tests`. An item stays private until another module calls it, so the `pub` items
  are the module's API.
<!-- /slot -->

<!-- slot: 2 -->
The repo carries no `rustfmt.toml` or `clippy.toml`, so the defaults are the house style.
The five steps are cargo commands:

| Step        | Runs                                                                          |
| ----------- | ----------------------------------------------------------------------------- |
| `check`     | `cargo fmt --check`                                                           |
| `lint`      | `cargo clippy --locked --all-targets -- -D warnings`, then `cargo deny check` |
| `typecheck` | the `lint` clippy command, which type-checks every target as it builds        |
| `test`      | `cargo test --locked`, the unit and integration suite                         |
| `test:e2e`  | `cargo test --locked --test e2e`, the Gherkin suite                           |

`cargo deny check` sits in `lint` because it lints the dependency graph and fails on a
finding (an unlisted crate, a build script, a RustSec advisory); `check` stays the
formatter alone and needs no network. `.githooks/pre-commit` runs `check`, `lint` and
`test` in that order, and each clone enables it with `git config core.hooksPath .githooks`.
With no CI, the hook is the gate and whoever merges runs `test:e2e` first.
<!-- /slot -->

<!-- slot: 3 -->
rustc's naming lints enforce Rust's conventions (`snake_case`, `UpperCamelCase` types,
`SCREAMING_SNAKE_CASE` constants). A slice's entry point is the bare module
(`src/preview.rs`); its layers are child modules named for the layer (`preview::db`).
<!-- /slot -->

<!-- slot: 4 -->
| Path                               | Holds                                                                       |
| ---------------------------------- | --------------------------------------------------------------------------- |
| `src/main.rs`, `src/bin/<name>.rs` | One binary each: `main` calls the library and returns its `ExitCode`        |
| `src/cli.rs`                       | Dispatch, and the one mapping from error to exit status ([§9](#9-errors-and-middleware)) |
| `src/cmd/<command>.rs`             | The edge, one per subcommand: parse arguments into a typed request, call the slice, print |
| `src/<slice>.rs` + `src/<slice>/`  | A slice: the bare module is the entry point, and its layers are private child modules (`store.rs`, `db.rs`), so the compiler keeps callers on the entry point |
| `src/<program>.rs`                 | A wrapper over one external program no slice owns (`git.rs`, `process.rs`) |

- **A command module never calls another command module.** A step two commands share
  (a teardown) lives in the slice.
- **Unit tests sit inline** in a `#[cfg(test)] mod tests` at the foot of their module;
  integration tests live in `tests/`, where cargo looks for them.
<!-- /slot -->

<!-- slot: 5 -->
**Every module opens with a `//!` comment**, `main.rs` and `src/bin/` files included, and
every `pub` item has a `///` comment. Then come the `use` lines, the public types and
functions highest level first, each `impl` beneath its type, each private helper beneath
its first caller, and `mod tests` last. Rust resolves items in any order, so the order
serves the reader alone.
<!-- /slot -->

<!-- slot: 5.1 -->
Rust has no named arguments. **A function takes a params struct once it has more than
two parameters, and every `bool` parameter becomes an enum.** A struct literal names every
field at the call site, and a variant says what `true` meant. `self` does not count.

```rust
// ✗ the call site is a puzzle: kill(&pids, true)
pub fn kill(pids: &[Pid], force: bool)
// ✓ kill(&pids, Signal::Kill), and past two: start_app(StartApp { run, port, log })
pub fn kill(pids: &[Pid], signal: Signal)
```

A trait method (`Display::fmt`, `Drop::drop`) and a closure handed to a std API keep the
signature the trait or the API defines.
<!-- /slot -->

<!-- slot: 5.2 -->
- **A multi-part value crosses a function boundary as a named struct.**
  `parse_band(..) -> (u16, u16)` becomes `-> Band { lo, hi }`.
- **`Result` is std's.** The failure type is an enum per function, one variant per code
  with the data the caller acts on, narrowed with `match`. Add no Result or error crate.
- **A lookup whose miss is a normal answer returns `Option`**, so the type checker makes
  every caller handle the miss that a sentinel (`""`, `0`) hides.
- **"Throw" is `?` on the app error.** A failure that ends the command propagates
  unchanged as `Err(AppError)` up to `cli::run` ([§9](#9-errors-and-middleware)). A
  caller whose only move on a classifying function's failure is to fail converts it with
  a `From` impl or `map_err`.
- **`panic!`, `unwrap` and `expect` mark bugs only**: a broken invariant the code itself
  guarantees. Input, I/O and subprocess failures return `Err`. Tests may unwrap.
- **A shell-out returns `Result`.** Its error carries the program, the exit status and
  the captured stderr, so `db::exists` returning `Result<bool, CmdError>` tells a broken
  connection from a missing database. A failure ignored on purpose is discarded with `let _ =`.
<!-- /slot -->

<!-- slot: 6 -->
**Does not apply.** A CLI ships no client bundle, and the core rule exempts it.
<!-- /slot -->

<!-- slot: 7.1 -->
**A state file is a schema.** Parse it at read time into a typed struct: an enum for each
closed set (`Flavor::Built`, `Flavor::Dev`), integers for ports, pids and epochs, and
`Option` for a key that may be absent. One function renders it back. A two-state choice
is an enum value (`mode=spa`), so a third state needs no format change.
<!-- /slot -->

<!-- slot: 7.2 -->
SQL lives in the slice's `db` module, and **no value is spliced into SQL text.** Pass
each value as a psql variable, referenced as `:'name'` (a quoted literal) or `:"name"` (a
quoted identifier). psql interpolates variables in SQL read from stdin or a file and
sends a `-c` string as written, so feed the statement on stdin:

```rust
// ✗ the value becomes SQL text
.args(["-tAc", &format!("select 1 from pg_database where datname='{name}'")])
// ✓ the value travels as a variable; stdin: select 1 ... where datname = :'name';
.args(["-tA", "-v", "ON_ERROR_STOP=1", "-v"]).arg(format!("name={name}"))
```

`createdb` and `dropdb` take the name as an argument and quote it themselves. A reader
returns `Result<Vec<T>, CmdError>`: no rows is `Ok(vec![])`, and a psql that fails to
start or exits non-zero is `Err`.
<!-- /slot -->

<!-- slot: 7.3 -->
A file has no compare-and-swap, so **a state file that two runs may rewrite is locked
across the whole read-modify-write**: an exclusive `File::lock` on a lock file beside it,
held from the read through a temp-file write and `fs::rename`. A concurrent run waits, a
reader sees the old file or the new one, and the lock releases when its `File` drops,
early `?` returns included.
<!-- /slot -->

<!-- slot: 8 -->
**Does not apply.** A CLI has no form, no session owner and no wire payload; each command
parses its arguments into a typed request once ([§4](#4-project-structure)).
<!-- /slot -->

<!-- slot: 9 -->
The app error is `AppError` in `src/error.rs`: a `code: Code`, a `message` for humans and
a `source: Option<Box<dyn Error + Send + Sync>>`, with `Display` and `Error` written by
hand. `Code` adds `Usage` to the core's codes for a malformed command line (an unknown
command or flag, a missing or unparseable value). **`cli::run` is the one place that maps
a code to an exit status**; it prints `<tool>: <message>` on stderr, and `main` returns
the status as `std::process::ExitCode`.

| Status | Meaning                                                                     |
| ------ | --------------------------------------------------------------------------- |
| 0      | success                                                                     |
| 1      | any app error except `Usage` (the fallback)                                 |
| 2      | `Usage`                                                                     |
| 101    | a panic, which is a bug (Rust's own status)                                 |
| 141    | stdout closed by its reader (`tool ls \| head`), as a shell reports SIGPIPE |

- **A command never picks a status.** A code gets its own status only when a caller
  branches on it, with a row here and in the tool's help.
- **stdout carries the result; stderr carries progress and diagnostics**, so an agent can
  parse stdout as it is. Output text, exit statuses and state-file formats are contracts,
  and changing one needs its scenario ([§11.1](#111-end-to-end-coverage)).
- **stdout goes through one macro that exits 141 on a broken pipe**, since Rust ignores
  SIGPIPE and `println!` panics. It is the one caller of `std::process::exit`, which
  skips destructors.
<!-- /slot -->

<!-- slot: 10 -->
**Does not apply.** A CLI has no UI layer; its help, output and exit statuses are
behavior, covered by [§9](#9-errors-and-middleware) and [§11.1](#111-end-to-end-coverage).
<!-- /slot -->

<!-- slot: 11 -->
- **Integration tests run the built binary** (`env!("CARGO_BIN_EXE_<name>")`) with
  `env_clear()` and an explicit environment, so nothing from the developer's shell
  (a `DATABASE_URL`, a real token) reaches the run.
- **Postgres is a throwaway cluster per scenario**, copied from a cached `initdb`
  template, listening only on a unix socket in a per-run directory, stopped on `Drop`.
  `PGHOST` points at that socket, or at an empty directory when the scenario starts none.
  That environment is the guard §11 requires, since no run can reach the development server.
- **Stub only programs that leave the machine, never return or are random** (`gh`,
  `tail -F`, `openssl rand`), as shell scripts first on `PATH`. psql, git and the tool's
  own modules run for real, with no mock crate and no trait-object fake.
- **Test ports come from a band derived from a hash of `CARGO_MANIFEST_DIR`**, so two
  worktrees' suites run at once. Scenarios sharing a band or stub hold one static `Mutex`.
- **An inline `mod tests` calls only its module's `pub` API.**
<!-- /slot -->

<!-- slot: 11.1 -->
**The runner is an in-repo Gherkin step runner over the integration harness**, so the
suite adds no crate. The `cucumber` crate cannot pass the allow-list in
[§0](#0-first-principle-idiomatic-stack-first): its `gherkin` parser has a build script,
and it pulls in proc-macro crates. Features live in `features/<capability>.feature`, the
runner in `tests/e2e/main.rs` and its step definitions in `tests/e2e/steps.rs`:

```toml
[[test]]
name = "e2e"
path = "tests/e2e/main.rs"
harness = false # the runner's own main reports each scenario
test = false    # `cargo test` skips it; `cargo test --test e2e` runs it
```

- **The parser takes a fixed Gherkin subset** (`Feature`, `Background`, `Scenario`,
  `Scenario Outline` with `Examples`, step keywords, tags, doc strings, comments) and
  fails the run on any other line, so no feature file is half read.
- **A step definition is a pattern with `{string}` and `{int}` placeholders.** A step
  matching no definition, or more than one, fails the run.
- **`@pending` is the one tag the runner excludes**; `-- --tags @smoke` selects the smoke
  subset, and the runner ignores every other tag, `@skip` included.
- **Each scenario gets a fresh cluster and stubs** ([§11](#11-testing)), which replaces
  the core's teardown sweep. Then-steps assert stdout, stderr, the exit status and the
  files the tool writes, with pids, ports and times normalized to placeholders.
- **Name the action in domain words** (`When the operator removes preview "a00001"`),
  with the argv in the step definition. Where the command line is the behavior under test
  (help, aliases, flag errors), the step quotes it: `When the operator runs "preview help"`.
<!-- /slot -->

<!-- slot: 12 -->
- **The package manager is cargo.** Commit `Cargo.lock`, which pins what the binary ships.
- **Pass `--locked` to every command that builds** (`build`, `test`, `clippy`, `run`,
  `install`), so a build that would change the lockfile fails. Only `cargo add` and
  `cargo update` change it, under the cooldown, with the lockfile diff reviewed.
- **Commit the cooldown in the repo's `.cargo/config.toml`** as well as the machine's, so
  any clone resolves under it. A cargo that warns it is ignoring `global-min-publish-age`
  enforces nothing; resolve with one that honors it. A same-day security fix may bypass
  it for one command with `CARGO_RESOLVER_INCOMPATIBLE_PUBLISH_AGE=allow`, and its commit
  message says why.
<!-- /slot -->

<!-- slot: 14 -->
1. **Rust CLI specifics?** A new crate comes with its allow-list entry and an ADR
   ([§0](#0-first-principle-idiomatic-stack-first)); no `bool` parameter, tuple return or
   sentinel ([§5.1](#51-function-signatures), [§5.2](#52-return-values)); every
   shell-out returns `Result` and passes values as arguments or psql variables
   ([§7.2](#72-data-access-modules-repositories)); only `cli::run` picks an exit status
   ([§9](#9-errors-and-middleware)); `--locked` on every build
   ([§12](#12-version-control-and-workflow)).
<!-- /slot -->
