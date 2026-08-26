#!/usr/bin/env node
// standards-sync.mjs — vendored, self-contained sync runner for the Arcnovus
// TanStack Start coding standard.
//
// Vendored from arcdev1/coding-standards; identical across every consumer repo.
// Do not fork it locally — edit it upstream.
//
// Modes:
//   (default)  Fetch the canonical CODING_STANDARDS.md body + VERSION + commit SHA;
//              if the local .standards-version SHA differs (or the file was
//              hand-edited), write:
//                <dest>/CODING_STANDARDS.md   generated header + body (no timestamp)
//                <dest>/.standards-version    { version, sha, bodyHash, syncedAt }
//   --check    Network-free: recompute the local body hash and compare it to
//              .standards-version.bodyHash; fail if the vendored file was hand-edited.
//
// Fetch: uses `gh api` when available (authenticated — higher rate limit, and works
// even if the canonical repo is private); otherwise falls back to unauthenticated
// HTTPS (raw.githubusercontent.com + api.github.com), so any Node 18+ environment
// can sync the public canonical repo with no gh install and no token.
//
// dest defaults to process.cwd(); override with STANDARDS_DEST=<path> or --dest <path>.

import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'

const CANONICAL_REPO = 'arcdev1/coding-standards'
const DEFAULT_BRANCH = 'main'
const STANDARD_PATH = 'CODING_STANDARDS.md'
const VERSION_PATH = 'VERSION'
const HEADER_SIGNATURE = '<!--\n  GENERATED — DO NOT EDIT.'

function parseArgs(argv) {
  const args = { check: false, dest: process.env.STANDARDS_DEST || process.cwd() }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--check') args.check = true
    else if (argv[i] === '--dest') args.dest = argv[++i]
  }
  args.dest = resolve(args.dest)
  return args
}

// Normalize line endings so hashing is CRLF- and autocrlf-insensitive.
const lf = (text) => text.replace(/\r\n/g, '\n')

function sha256(text) {
  return createHash('sha256').update(lf(text), 'utf8').digest('hex')
}

// Exact inverse of renderVendored(): the body is everything after the generated
// header's `-->\n\n` separator. Returns input unchanged if no header.
const HEADER_END = '-->\n\n'
function stripHeader(fileText) {
  const text = lf(fileText)
  if (!text.startsWith(HEADER_SIGNATURE)) return text
  const idx = text.indexOf(HEADER_END)
  return idx === -1 ? text : text.slice(idx + HEADER_END.length)
}

function renderVendored(body, version, shortSha) {
  const header =
    `<!--\n` +
    `  GENERATED — DO NOT EDIT.\n` +
    `  Source: ${CANONICAL_REPO} · ${STANDARD_PATH}\n` +
    `  Version: ${version} · commit: ${shortSha}\n` +
    `  Edit upstream (${CANONICAL_REPO}) and re-run \`pnpm standards:sync\`.\n` +
    `  Local edits here are overwritten on the next sync.\n` +
    `-->\n\n`
  return header + body
}

// ---- fetch: gh first (auth), then unauthenticated HTTPS (public) ----

function gh(pathArgs, { raw = false } = {}) {
  const extra = raw ? ['-H', 'Accept: application/vnd.github.raw'] : []
  return execFileSync('gh', ['api', ...extra, ...pathArgs], {
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

function fetchViaGh() {
  const body = gh([`repos/${CANONICAL_REPO}/contents/${STANDARD_PATH}`], { raw: true })
  const version = gh([`repos/${CANONICAL_REPO}/contents/${VERSION_PATH}`], { raw: true }).trim()
  const sha = gh([
    `repos/${CANONICAL_REPO}/commits?path=${STANDARD_PATH}&per_page=1`,
    '-q',
    '.[0].sha',
  ]).trim()
  if (!sha) throw new Error('gh returned an empty commit SHA')
  return { body, version, sha, shortSha: sha.slice(0, 7) }
}

async function httpGet(url, { json = false } = {}) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'standards-sync',
      Accept: json ? 'application/vnd.github+json' : 'text/plain',
    },
  })
  if (!res.ok) throw new Error(`GET ${url} → HTTP ${res.status}`)
  return json ? res.json() : res.text()
}

async function fetchViaHttp() {
  const raw = `https://raw.githubusercontent.com/${CANONICAL_REPO}/${DEFAULT_BRANCH}`
  const api = `https://api.github.com/repos/${CANONICAL_REPO}`
  const body = await httpGet(`${raw}/${STANDARD_PATH}`)
  const version = (await httpGet(`${raw}/${VERSION_PATH}`)).trim()
  const commits = await httpGet(`${api}/commits?path=${STANDARD_PATH}&per_page=1`, { json: true })
  const sha = Array.isArray(commits) && commits[0] && commits[0].sha
  if (!sha) throw new Error('api.github.com returned no commit SHA')
  return { body, version, sha, shortSha: sha.slice(0, 7) }
}

async function fetchCanonical() {
  try {
    return fetchViaGh()
  } catch (ghErr) {
    try {
      return await fetchViaHttp()
    } catch (httpErr) {
      const ghMsg = (ghErr.stderr || ghErr.message || '').toString().trim().split('\n')[0]
      throw new Error(
        `Could not fetch the canonical standard from ${CANONICAL_REPO}.\n` +
          `  via gh:    ${ghMsg}\n` +
          `  via https: ${httpErr.message}\n` +
          `Check network access, or install/auth gh (\`gh api user\`).`,
      )
    }
  }
}

function readLocalMeta(dest) {
  const p = join(dest, '.standards-version')
  if (!existsSync(p)) return null
  try {
    return JSON.parse(readFileSync(p, 'utf8'))
  } catch {
    return null
  }
}

function runCheck(dest) {
  const mdPath = join(dest, STANDARD_PATH)
  const meta = readLocalMeta(dest)
  if (!existsSync(mdPath) || !meta) {
    console.error(
      `standards:check FAILED — missing ${STANDARD_PATH} or .standards-version in ${dest}. ` +
        `Run \`pnpm standards:sync\`.`,
    )
    process.exit(1)
  }
  const localHash = `sha256:${sha256(stripHeader(readFileSync(mdPath, 'utf8')))}`
  if (localHash !== meta.bodyHash) {
    console.error(
      `standards:check FAILED — ${STANDARD_PATH} was hand-edited (body hash mismatch).\n` +
        `  expected ${meta.bodyHash}\n  got      ${localHash}\n` +
        `This file is generated; edit upstream (${CANONICAL_REPO}) and re-run \`pnpm standards:sync\`.`,
    )
    process.exit(1)
  }
  console.log(`standards:check OK — vendored ${STANDARD_PATH} matches v${meta.version} (${meta.sha.slice(0, 7)}).`)
}

async function runSync(dest) {
  const { body, version, sha, shortSha } = await fetchCanonical()
  const expectedBodyHash = `sha256:${sha256(body)}`
  const mdPath = join(dest, STANDARD_PATH)
  const local = readLocalMeta(dest)
  const currentBodyHash = existsSync(mdPath)
    ? `sha256:${sha256(stripHeader(readFileSync(mdPath, 'utf8')))}`
    : null

  // Skip only when the file is BOTH current (SHA matches) AND untampered (body
  // matches). A hand-edit leaves the SHA equal but the body hash different, so
  // this still repairs it — sync is self-healing, not just SHA-gated.
  if (local && local.sha === sha && currentBodyHash === expectedBodyHash) {
    console.log(`standards:sync — already up to date (v${version}, ${shortSha}). No changes.`)
    return
  }

  const meta = {
    version,
    sha,
    shortSha,
    bodyHash: expectedBodyHash,
    source: CANONICAL_REPO,
    syncedAt: new Date().toISOString(),
  }
  writeFileSync(mdPath, renderVendored(body, version, shortSha))
  writeFileSync(join(dest, '.standards-version'), JSON.stringify(meta, null, 2) + '\n')

  let action
  if (!local) action = `wrote v${version} (${shortSha})`
  else if (local.sha !== sha) action = `updated ${local.shortSha} → ${shortSha}`
  else action = `repaired hand-edited file (v${version}, ${shortSha})`
  console.log(`standards:sync — ${action} in ${dest}.`)
}

try {
  const { check, dest } = parseArgs(process.argv.slice(2))
  if (check) runCheck(dest)
  else await runSync(dest)
} catch (err) {
  console.error(err.message || err)
  process.exit(1)
}
