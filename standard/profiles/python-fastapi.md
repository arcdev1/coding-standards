---
name: python-fastapi
title: Python on FastAPI
summary: A Python HTTP backend on FastAPI and PostgreSQL (psycopg 3), with pydantic, a Drizzle-owned schema, pytest, ruff, pyright and uv. Usually the server half of an app whose UI is a separate frontend.
---

<!-- slot: stack -->
- **Framework.** FastAPI on Python 3.12 or later, served by uvicorn. It is usually the
  server half of an app whose UI is a separate frontend calling it over HTTP.
- **Data.** PostgreSQL through psycopg 3 and `psycopg_pool`, with parameterized SQL. A
  Drizzle package beside the backend (`db/`) owns the schema and the migrations.
- **Tooling.** pydantic, pytest with `TestClient` over httpx2, uv, hatchling, ruff, pyright,
  import-linter.
<!-- /slot -->

<!-- slot: 0 -->
The blessed primitive for each concern on this stack:

| Concern                     | Use                                                               | Not                                                     |
| --------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------- |
| HTTP API                    | one `APIRouter` per slice, included once in `main.py`             | routes declared on `app` across modules                 |
| Request and response shape  | pydantic models on the handler signature and as its return type   | `await request.json()` by hand; a `dict[str, Any]` body |
| Per-request context         | a `Depends` dependency (session, owner scope, an external client) | a module global; a guard called in each handler         |
| DB access                   | psycopg 3 through the shared `psycopg_pool.ConnectionPool`        | a connection per call; a second driver or an ORM        |
| Schema and migrations       | the Drizzle package in `db/` ([§7.4](#74-migrations))             | DDL issued from Python; Alembic beside Drizzle          |
| Outbound HTTP               | httpx2, the httpx successor Starlette's `TestClient` runs on      | `urllib.request`; the deprecated `httpx`                |
| Failures that end a request | `AppError` and one exception handler ([§9](#9-errors-and-middleware)) | `HTTPException` raised in each router               |
<!-- /slot -->

<!-- slot: 1 -->
- **Type hints on every signature.** Annotate every parameter and every return, `-> None`
  included. Each module opens with `from __future__ import annotations`, so a signature can
  name a type defined further down ([§5](#5-module-organization)).
- **Absolute imports from the package root.** Write `from app.core.db import connection`. A
  relative import may reach a sibling in the same package (`from .base import JobResult`)
  and never a parent.
- **`__all__` is the public API.** A module lists what others may import in `__all__` and
  prefixes every other name it defines with `_`, which pyright strict bars other modules
  from importing. A package whose internals churn exposes a seam module, `api.py`, whose
  `__all__` is the contract.
<!-- /slot -->

<!-- slot: 2 -->
**ruff** lints and formats at line length 100. On top of `E`, `F`, `I`, `UP` and `B` it
selects `ANN` for missing annotations (ignored under `tests/`), `TID252` with
`ban-relative-imports = "parents"`, and `S608` for SQL built from strings.

**pyright** type-checks in strict mode, because it reads pydantic and dataclasses through
`dataclass_transform` with no plugin, and its `reportUnknown*` checks catch `Any` leaking in
from untyped code. `tests/` checks in standard mode, since pytest injects fixtures by name.
Install it with `uv add --dev "pyright[nodejs]"`, which locks its Node runtime as a wheel.

**import-linter** checks the slice rule ([§4](#4-project-structure)) with an `independence`
contract over the slices and a `forbidden` contract from `app.core` to each slice.

| Step        | Command, from the backend root                                                      |
| ----------- | ----------------------------------------------------------------------------------- |
| `check`     | `uv run ruff format --check .`                                                      |
| `lint`      | `uv run ruff check . && uv run lint-imports`                                        |
| `typecheck` | `uv run pyright`                                                                    |
| `test`      | `uv run pytest`                                                                     |
| `test:e2e`  | the frontend's `test:e2e`, booting this backend ([§11.1](#111-end-to-end-coverage)) |
<!-- /slot -->

<!-- slot: 3 -->
Names follow PEP 8: `snake_case` modules, functions and variables, `PascalCase` classes,
`UPPER_SNAKE` constants, and a leading `_` for anything private to its module. The service
is the bare slice name (`order/order.py`); every other layer takes an underscore suffix.
<!-- /slot -->

<!-- slot: 4 -->
Slices are packages under `app/`, on a thin core. The module suffix names the layer:
`<slice>_schemas.py` holds the pydantic models, `<slice>.py` is the service
([§8](#8-domain--service-layer-and-validation)), `<slice>_repo.py` is data access
([§7.2](#72-data-access-modules-repositories)), and `<slice>_router.py` is the slice's
`APIRouter`. A suffix keeps module names unique, so a traceback names the layer.

- **The import rule.** Slices import `app.core`, slices never import each other, and
  `app.core` imports no slice. Code two slices need moves into `app.core`. `app/main.py`,
  the composition root, is the only module that imports every slice's router.
- **Fixed homes.** `app/core/` holds the pool and `connection()` (`db.py`), `AppError`,
  `Result`, and kernels no slice owns; `e2e/` holds the test-only entrypoint.
- **Tests mirror the package tree.** `tests/order/test_order_repo.py` tests
  `app/order/order_repo.py`, under pytest's `--import-mode=importlib`.
<!-- /slot -->

<!-- slot: 5 -->
Python resolves a global name when the line reading it runs, and a function body runs at
call time, so a helper may sit below its caller. Every module opens with a docstring.

- **Names read at import time go above their first use.** That covers a constant another
  top-level statement reads, a default argument value, a decorator argument, a base class,
  and an `Annotated` alias.
- **Pydantic models go above the handlers that name them.** FastAPI resolves a handler's
  annotations when its decorator runs, so it reads a body model defined below as a query
  parameter and the route answers every request with 422.
<!-- /slot -->

<!-- slot: 5.1 -->
The named-argument form is **keyword-only parameters after a bare `*`**:
`def reconcile(*, order: Order, dry_run: bool = False) -> Report`, called as
`reconcile(order=order, dry_run=True)`. A single obvious argument may stay positional ahead
of the `*`: `run_worker(argv, *, cwd=None, env=None)`.

FastAPI owns route handlers, exception handlers, middleware and `lifespan`, and pytest owns
tests and fixtures. A handler takes its parameters as FastAPI documents them, then calls the
service with keywords.
<!-- /slot -->

<!-- slot: 5.2 -->
A multi-value return is a **frozen dataclass** (`@dataclass(frozen=True, slots=True)`). A
`NamedTuple` unpacks by position, so this rule counts it as a tuple; a homogeneous
`tuple[str, ...]` is one value and stays.

`app/core/result.py` defines `Ok[T]` (a `value`) and `Err[E]` (an `error`) as frozen
dataclasses, and `type Result[T, E] = Ok[T] | Err[E]`. Each failure is a frozen dataclass
with a `Literal` `code`. The caller narrows with `match`, and pyright checks each arm:

```python
match match_order(context=context, reference=row.reference):  # Result[Order, NoMatch | Ambiguous]
    case Ok(value=order):
        applied.append(apply_payment(context=context, order=order, row=row))
    case Err(error=failure):
        rejected.append(Rejection(row=row, reason=failure.code))
```

Add no Result library (`returns`, `result`), whose chaining API reads unlike the rest of a
FastAPI codebase. A router never returns an `Err`, which FastAPI would send as a 200. A
`with conn.transaction()` block rolls back only on an exception, so returning an `Err` from
inside one commits what it wrote.
<!-- /slot -->

<!-- slot: 6 -->
The whole backend is server-only and the frontend reaches it only over HTTP, so no secret,
credential, or DSN leaves in a response body, an error, or the OpenAPI schema.
<!-- /slot -->

<!-- slot: 7.2 -->
A data-access module is the slice's `<slice>_repo.py`. Its functions take keyword-only
`context` and `query`, each a frozen dataclass; `context` carries the owner scope and, when
the caller holds a transaction, its connection. `connection(context)` in `app/core/db.py`
yields that connection, or a pooled one when none is set, so several calls compose.

```python
def find_by_id(*, context: Context, query: OrderIdQuery) -> list[Order]:
    with connection(context) as conn, conn.cursor(row_factory=class_row(Order)) as cur:
        cur.execute("SELECT id, status, version FROM orders WHERE id = %s", (query.id,))
        return cur.fetchall()  # a list even by id, so a duplicate surfaces
```

- **Placeholders carry every value.** A varying identifier goes through `psycopg.sql`.
- **Rows map into frozen dataclasses through `class_row`.** A row read by position
  (`row[3]`) returns the wrong column once the `SELECT` list is reordered.
- **A write that spans statements runs inside `with conn.transaction()`.** The pool hands
  out autocommit connections, so each statement outside that block commits on its own.
- **Owner scope is a closed union.** The clause builder matches `OwnerOnly | AllOwners` and
  ends in `case _: assert_never(scope)`, so pyright fails an unhandled case.
<!-- /slot -->

<!-- slot: 7.3 -->
The `version` column lives in the Drizzle schema. Run the core's `UPDATE … RETURNING id`
through `conn.execute(...).fetchone()`; a `None` back is `CONFLICT` or `NOT_FOUND`.
<!-- /slot -->

<!-- slot: 7.4 -->
The Drizzle package in `db/` owns the schema, so the core rule applies as written, through
its scripts (`pnpm --dir db generate`, `pnpm --dir db migrate`). Python issues no DDL. Drizzle
Kit generates no down migrations, and a hand-written one breaks the rule above, so a
rollback is a new generated forward migration.
<!-- /slot -->

<!-- slot: 8 -->
The shared schema is the pydantic request model. It validates at the edge, and FastAPI
publishes it at `/openapi.json` for the frontend's types and form rules. A validator judges
the normalized value and returns the raw one, and no model config rewrites input
(`str_strip_whitespace`, `str_to_lower`):

```python
def _check_email(value: str) -> str:
    if not _EMAIL.fullmatch(value.strip().lower()):
        raise ValueError("Enter a valid email address")
    return value  # judged normalized, returned raw: the service cleans

Email = Annotated[str, AfterValidator(_check_email)]
```

The `*Payload` is the pydantic model; `*Draft`, `*Write`, `*Insert` and `*Aggregate` are
frozen dataclasses. The owner comes from the `Depends` context and has no payload field.
<!-- /slot -->

<!-- slot: 9 -->
`AppError` lives in `app/core/app_error.py`, with `ErrorCode` a `Literal` of the six codes.
`raise AppError("CONFLICT", "...") from exc` wraps an underlying error as its cause.
`main.py` installs the one handler:

```python
class AppError(Exception):  # app/core/app_error.py
    def __init__(self, code: ErrorCode, message: str | None = None) -> None:
        super().__init__(message or code)
        self.code = code

@app.exception_handler(AppError)  # app/main.py
async def _app_error(_request: Request, exc: AppError) -> JSONResponse:
    status = STATUS_BY_CODE.get(exc.code, 422)  # 401, 403, 404, 409; 422 otherwise
    return JSONResponse({"code": exc.code, "detail": str(exc)}, status_code=status)
```

- **A router raises no `HTTPException` for a domain failure.** It names no status code,
  and FastAPI's own 422 for a request that fails its model stays as it is.
- **A domain error subclasses no built-in.** An `except KeyError` around a dict lookup, or
  an `except ValueError` around a parse, would catch it by accident.
<!-- /slot -->

<!-- slot: 10 -->
This backend renders no UI, so §10 binds its frontend. The backend's part is an `AppError`
message a user can act on, since the frontend shows it.
<!-- /slot -->

<!-- slot: 11 -->
- **pytest runs against real PostgreSQL.** `conftest.py` derives the database for the
  worktree (`<app>_test_<hash>`) and creates it from a migrated template when absent.
- **A DB test that can't reach its database fails and never skips.** `pytest_sessionstart`
  connects once and raises `pytest.UsageError` when the database is unreachable or its name
  falls outside the test family (an allow-list with no override). A `skipif` on a missing
  DSN reports green with the data layer untested.
- **An autouse fixture truncates the app's tables before each DB test.** The code under
  test takes its own pooled connections, which a per-test rollback can't reach.
- **Never monkeypatch the pool, a connection, or a data-access function.** Fake only the
  true external boundary (a process, a network service, hardware), through
  `app.dependency_overrides` or `monkeypatch.setitem` on an adapter registry.
- **Integration tests call the service ([§8](#8-domain--service-layer-and-validation)).** A
  `TestClient` test covers what only the edge owns: the route, the model's 422, and the
  status each `AppError` maps to.
<!-- /slot -->

<!-- slot: 11.1 -->
This backend has no interface of its own, so its `test:e2e` is the frontend's playwright-bdd
suite, whose `webServer` boots it with `uv run python -m e2e.serve`. `e2e/serve.py` refuses
a database outside the end-to-end family, applies the migrations, installs doubles at the
external boundary only, adds a `POST /__e2e/reset` route, and serves `app.main:app`.
Production never imports `e2e/`.
<!-- /slot -->

<!-- slot: 12 -->
- **The Python package manager is uv.** Add with `uv add` (`--dev` for tools), commit
  `uv.lock`, run through `uv run`, and install in CI with `uv sync --locked`, which fails
  on a stale lock. pip, pip-tools and Poetry stay out.
<!-- /slot -->

<!-- slot: 14 -->
1. **FastAPI specifics?** Signatures typed, public names in `__all__`
    ([§1](#1-language-and-imports)); no tuple return or positional row read
    ([§5.2](#52-return-values)); multi-statement writes inside `conn.transaction()`
    ([§7.2](#72-data-access-modules-repositories)); `AppError` with no `HTTPException`
    for domain failures ([§9](#9-errors-and-middleware)); no `skipif` on a DB test and no
    faked pool ([§11](#11-testing)).
<!-- /slot -->
