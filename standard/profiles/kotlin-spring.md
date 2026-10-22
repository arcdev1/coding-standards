---
name: kotlin-spring
title: Kotlin on Spring Boot
summary: A Kotlin JVM service on Spring Boot 4 and Spring MVC, typically an internal HTTP service with no UI of its own, built with Gradle and checked with spotless, ktlint and detekt.
---

<!-- slot: stack -->
- **Shape.** An internal HTTP service with no UI. Users reach it through a consuming app.
- **Language.** Kotlin 2 on the JVM, with a JDK 25 toolchain.
- **Framework.** Spring Boot 4, Spring MVC, Bean Validation, Jackson 3 with its Kotlin module.
- **Build.** Gradle 9 through the wrapper, with a version catalog.
- **Tests and tooling.** JUnit Jupiter with kotest assertions, spotless running ktlint, detekt.
<!-- /slot -->

<!-- slot: 0 -->
| Concern            | Use                                                    | Not                                              |
| ------------------ | ------------------------------------------------------ | ------------------------------------------------ |
| HTTP endpoints     | Spring MVC `@RestController`                           | servlet code that parses requests by hand        |
| Request validation | Bean Validation on data-class DTOs ([§8](#8-domain--service-layer-and-validation)) | `if` checks in controllers |
| JSON               | Jackson 3 with `jackson-module-kotlin`                 | hand-built or regex-parsed JSON, in tests too    |
| Error responses    | `@RestControllerAdvice` returning `ProblemDetail`      | `ResponseStatusException`, try/catch in handlers |
| Configuration      | `@ConfigurationProperties` data classes                | `@Value` strings spread across beans             |
| Wiring             | constructor injection                                  | `@Autowired lateinit var` fields                 |
| Health probes      | Spring Boot Actuator                                   | a hand-written health endpoint                   |
| Time               | an injected `java.time.Clock` bean                     | `Instant.now()`, `System.currentTimeMillis()`    |
| Per-caller auth    | Spring Security, once callers have identities or roles | hand-rolled session or role checks               |

- **The `@SpringBootApplication` class sits in the root package.** Default component
  scanning then reaches every slice, and a `scanBasePackages` attribute means it is misplaced.
<!-- /slot -->

<!-- slot: 1 -->
- **Two compiler options set the strictness.** In `kotlin { compilerOptions }`,
  `allWarningsAsErrors = true` fails the build on any warning, and `-Xjsr305=strict` turns
  the nullability annotations on Java APIs into Kotlin types. A `@Suppress` on a compiler
  warning is the same smell as a setting switched off.
- **Visibility names the API.** Helpers are `private` to their class or file. `internal`
  spans the whole Gradle module, so it hides nothing between the slices of one service.
<!-- /slot -->

<!-- slot: 2 -->
**spotless** applies `ktlint()` to `kotlin` and `kotlinGradle` sources in ktlint's default
`ktlint_official` style, with any exception in `.editorconfig`. **detekt** runs with
`buildUponDefaultConfig = true` over `config/detekt.yml`, on the release built against the
project's Kotlin version, since it analyzes through its own embedded compiler. Its
`NamedArguments` and `ForbiddenMethodCall` rules need type resolution, which only
`detektMain` and `detektTest` run. Import Spring Boot's BOM with Gradle's `platform()`,
because the `io.spring.dependency-management` plugin rewrites the Kotlin version in every
configuration, detekt's included, and detekt then fails.

```kotlin
// build.gradle.kts
val lint by tasks.registering { dependsOn("detektMain", "detektTest") }
val typecheck by tasks.registering { dependsOn("compileKotlin", "compileTestKotlin") }
tasks.check { dependsOn(lint) }
```

Gradle's `check` then depends on `spotlessCheck`, `lint` and `test`, so `./gradlew build`
runs the gate in CI:

| Step        | Runs                                                                           |
| ----------- | ------------------------------------------------------------------------------ |
| `check`     | `./gradlew spotlessCheck` (`spotlessApply` fixes)                              |
| `lint`      | `./gradlew lint`, detekt with type resolution over main and test               |
| `typecheck` | `./gradlew typecheck`, the Kotlin compile of main and test                     |
| `test`      | `./gradlew test`                                                               |
| `test:e2e`  | none of its own: the consuming app's suite ([§11.1](#111-end-to-end-coverage)) |
<!-- /slot -->

<!-- slot: 3 -->
- **Files are PascalCase and named for the top-level type they hold.** Packages are
  lowercase single words, one per slice (`com.arcnovus.<app>.order`), constants are
  `const val` in `SCREAMING_SNAKE_CASE`, and a test class is `<Subject>Test`.
- **The service carries no `Service` or `Impl` suffix.** Name it for what it does: an agent
  noun for a capability (`TextExtractor`), the plural for an aggregate (`Orders`). Other
  layers carry Spring's suffixes (`OrderController`, `OrderRepository`).
<!-- /slot -->

<!-- slot: 4 -->
A slice is a package under the root, and the file name says the layer:

| File                   | Layer                                                                          |
| ---------------------- | ------------------------------------------------------------------------------ |
| `<Slice>Controller.kt` | The transport edge: a `@RestController` over the service                       |
| `<Slice>Dtos.kt`       | Wire types: `*Payload` request bodies with Bean Validation, `*Response` bodies |
| `<Service>.kt`         | The service, the slice's only entry point ([§3](#3-naming))                    |
| `<Slice>Repository.kt` | Data access, once the service has a database                                   |

- **One public type per file.** A type that exists only to serve it (its result data class,
  its failure union) shares its file. Tests mirror the package under `src/test/kotlin`.
- **Cross-cutting homes.** The root package holds the `@SpringBootApplication` class alone,
  `error` holds the app error and its advice ([§9](#9-errors-and-middleware)), `auth` holds
  the bearer filter, and `lib` holds kernels with no owning slice (`Result`, the `Clock`).
<!-- /slot -->

<!-- slot: 5 -->
- **The KDoc on a file's primary declaration is its doc comment.** It cites the ADR that
  decided the type's shape, when one exists.
- **Members follow Kotlin's class layout.** Activate detekt's `ClassOrdering` to enforce it:
  properties and `init` blocks, secondary constructors, functions, then the companion
  object, so constants come last. Each private helper sits beneath its first caller.
- **Initializers run top to bottom.** An initializer that calls a function reading a
  property declared further down sees that property at its JVM default (`null`, `0`,
  `false`), whatever its declared type.
<!-- /slot -->

<!-- slot: 5.1 -->
The named-argument form is **named arguments at the call site**, or one parameter data class
for a group that travels together ([§13](#13-code-smell-baseline), Data Clumps). detekt's
`NamedArguments` checks it, with `allowedArguments: 1` and `ignoreArgumentsMatchingNames: true`:

```kotlin
reconcile(order, true, false) //                         ✗ positional: two unlabeled booleans
reconcile(order = order, dryRun = true, force = false) // ✓ every argument names itself
```

- **An argument named for its parameter needs no label.** `place(context, input)` passes,
  and the two swapped fails. Java parameters have no stable names, so Java calls stay
  positional.
- **Framework-owned signatures follow Spring.** A controller method takes what Spring binds
  (`@PathVariable`, `@RequestBody`), and an override (`doFilterInternal`) keeps its own.
<!-- /slot -->

<!-- slot: 5.2 -->
A multi-value return is a data class, read by property name. Never return `Pair` or
`Triple`, and never destructure a data class positionally. Destructuring binds by
declaration order, so reordering two properties of one type swaps them silently. The
`Result` lives in `lib/Result.kt`, its explicit import shadowing the default `kotlin.Result`,
and the caller narrows it with an exhaustive `when`.

```kotlin
/** The outcome of a function whose failures are branches its caller handles. */
sealed interface Result<out T, out E : Failure> {
    data class Ok<out T>(val value: T) : Result<T, Nothing>
    data class Err<out E : Failure>(val error: E) : Result<Nothing, E>
}
interface Failure { val code: String }

sealed class OrderMatchFailure(override val code: String) : Failure {
    data object NoMatch : OrderMatchFailure("NO_MATCH")
    data class Ambiguous(val candidates: List<Order>) : OrderMatchFailure("AMBIGUOUS")
}
```

- **Never use `kotlin.Result` or a Result library.** `kotlin.Result` and `runCatching` take
  any `Throwable` as the failure, so the caller gets no typed union, and `runCatching` is a
  catch-all.
- **Transactions roll back on every exception.** Declare
  `@Transactional(rollbackFor = [Exception::class])`. Spring's default rolls back only on
  unchecked exceptions, and Kotlin does not flag a Java checked one such as `IOException`.
<!-- /slot -->

<!-- slot: 6 -->
- **A shared bearer token authenticates the caller.** A `OncePerRequestFilter` checks it on
  every request but the health probe, comparing the `Authorization` header with
  `MessageDigest.isEqual`, whose running time does not depend on where the bytes differ.
- **A blank token fails startup outside the `local` profile.** The filter's constructor
  throws when the token is blank and `environment.matchesProfiles("local")` is false, so a
  deployment missing its secret refuses to start. `application.yml` reads the token from
  `${INTERNAL_AUTH_TOKEN:}`. The build activates `local` on `bootRun` alone
  (`tasks.bootRun { systemProperty("spring.profiles.active", "local") }`), which local dev
  and the consuming app's E2E harness use.
<!-- /slot -->

<!-- slot: 7.1 -->
**§7 applies once the service has a database.** Adding one starts with an ADR that picks the
data-access approach and shows how it meets §7.1 to §7.4, including what §7.4's migrations
are generated from (Flyway alone runs hand-written SQL, which §7.4 rules out).
<!-- /slot -->

<!-- slot: 8 -->
- **Bean Validation on the `*Payload` data class is the shared schema.** `@Valid @RequestBody`
  runs it. Constraints take the `@field:` target (`@field:NotBlank`), and a nested payload
  is `@field:Valid`. A non-null property needs no `@NotNull`.
- **A format a constraint can express is a constraint.** A pattern, a size, or an allowed
  set fails at the edge with Spring's 400, which `spring.mvc.problemdetails.enabled: true`
  renders as a `ProblemDetail`. A rule that needs decoded content or other state is the
  service's, thrown as `VALIDATION`.
- **Constraints stay lenient.** Where a stock constraint judges the raw value (`@Email` on
  `" ada@x.com "`), write a custom one that judges the trimmed, case-folded value.
<!-- /slot -->

<!-- slot: 9 -->
`ErrorCode` is an enum of the six codes, and `AppException(code, message, cause)` extends
`RuntimeException`, both in the `error` package. One advice sets every status:

```kotlin
@RestControllerAdvice
class AppExceptionHandler {
    @ExceptionHandler
    fun handle(exception: AppException): ProblemDetail =
        ProblemDetail.forStatusAndDetail(statusFor(exception.code), exception.message)
            .apply { setProperty("code", exception.code.name) }
}
```

- **The status mapping is exhaustive.** `statusFor` is a `when` over `ErrorCode` with no
  `else`, so a new code fails to compile until it is mapped. `VALIDATION` and `UNKNOWN` map
  to `HttpStatus.UNPROCESSABLE_CONTENT`.
- **No code throws `ResponseStatusException`.** detekt's `ForbiddenImport` lists it. Any
  other throw reaches Spring's default 500, so add no `@ExceptionHandler(Exception::class)`.
- **A filter runs before the dispatcher, outside the advice.** The bearer filter passes its
  `AppException(ErrorCode.NOT_AUTHENTICATED)` to the bean injected with
  `@Qualifier("handlerExceptionResolver")`, calling
  `resolveException(request, response, null, exception)`, and the advice maps it.
<!-- /slot -->

<!-- slot: 10 -->
**§10 does not apply while the service has no UI.** The consuming app's §10 rules govern it.
<!-- /slot -->

<!-- slot: 11 -->
- **Test two seams, both real.** Service rules go through the service class or bean. The
  HTTP contract (routes, binding, status mapping, auth) goes through
  `@SpringBootTest(webEnvironment = RANDOM_PORT)` and `RestTestClient`
  (`@AutoConfigureRestTestClient`), which decodes bodies with Jackson. Spring tests set and
  send a token, and one asserts a 401 without it.
- **Mock nothing the service owns.** Replace only a true external boundary (a third-party
  API, a native binary), with a fake of the service's own interface from a
  `@TestConfiguration`.
- **Time comes from the injected `Clock`.** Tests pass `Clock.fixed(...)`, and detekt's
  `ForbiddenMethodCall` lists `java.time.Instant.now()`, `java.time.LocalDate.now()` and
  `java.lang.System.currentTimeMillis`.
- **The port comes from `PORT`.** `server.port: ${PORT:8080}` takes the consuming app's
  worktree-derived port, and tests use `RANDOM_PORT`.
<!-- /slot -->

<!-- slot: 11.1 -->
**The service has no `test:e2e` of its own.** The consuming app's scenarios cover what users
observe through it, its E2E harness starting the service with `./gradlew bootRun`. A service
change users can observe is complete when the app's scenario for it passes.
<!-- /slot -->

<!-- slot: 12 -->
- **Gradle runs through the committed wrapper.** Call `./gradlew`, never a system `gradle`,
  and keep every dependency and plugin version in `gradle/libs.versions.toml`.
<!-- /slot -->

<!-- slot: 14 -->
1. **Kotlin and Spring specifics?** Named arguments ([§5.1](#51-function-signatures)), no
   `Pair`, `Triple` or positional destructuring ([§5.2](#52-return-values)), no
   `ResponseStatusException` ([§9](#9-errors-and-middleware)), no wall-clock read
   ([§11](#11-testing)), and a blank token fails startup ([§6](#6-server--client-boundary)).
<!-- /slot -->
