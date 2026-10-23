#!/usr/bin/env node
// standards-sync.mjs — vendored, self-contained sync runner for the Arcnovus
// coding standard.
//
// Vendored from arcdev1/coding-standards; identical across every consumer repo.
// Do not fork it locally — edit it upstream.
//
// The canonical standard is a core (standard/core.md) plus stack profiles
// (standard/profiles/<name>.md). A consumer names its profiles in
// <dest>/.standards.json; with no config file it gets the tanstack-start profile:
//
//   {
//     "profiles": ["tanstack-start"],                      // or { "name", "scope" }
//     "local": [{ "path": "docs/standards/local.md", "scope": "frontend/" }]
//   }
//
// A local profile is a file in the consumer repo, written in the same slot format,
// for the rules only that project has. The runner fills each `<!-- profile: ID -->`
// marker in the core with the matching `<!-- slot: ID -->` block of every profile, in
// order, and labels the blocks when more than one profile fills a slot.
//
// Modes:
//   (default)  Fetch VERSION, the core and the named profiles at the canonical main
//              HEAD; if the local .standards-version SHA differs (or the file was
//              hand-edited, or a local profile changed), write:
//                <dest>/CODING_STANDARDS.md   generated header + body (no timestamp)
//                <dest>/.standards-version    { version, sha, profiles, bodyHash, … }
//   --check    Network-free: recompute the local body hash (and each local profile's
//              hash) and compare them to .standards-version; fail if the vendored
//              file was hand-edited or a local profile changed without a re-sync.
//
// Fetch: uses `gh api` when available (authenticated — higher rate limit, and works
// even if the canonical repo is private); otherwise falls back to unauthenticated
// HTTPS (raw.githubusercontent.com + api.github.com), so any Node 18+ environment
// can sync the public canonical repo with no gh install and no token.
//
// dest defaults to process.cwd(); override with STANDARDS_DEST=<path> or --dest <path>.
// --source <dir> reads the standard from a local checkout of the canonical repo
// instead of fetching it, to rehearse a change before it is merged.

import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, existsSync, realpathSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const CANONICAL_REPO = 'arcdev1/coding-standards'
const DEFAULT_BRANCH = 'main'
const STANDARD_PATH = 'CODING_STANDARDS.md'
const CORE_PATH = 'standard/core.md'
const PROFILE_DIR = 'standard/profiles'
const VERSION_PATH = 'VERSION'
const CONFIG_FILE = '.standards.json'
const DEFAULT_PROFILES = ['tanstack-start']
const HEADER_SIGNATURE = '<!--\n  GENERATED — DO NOT EDIT.'

// ---- assembly: core + profiles → one standard ----

/**
 * Assembles the standard from the core text and the profiles, in order. Each
 * profile is { name, title, scope?, slots: Map<id, text> }. Throws when a profile
 * fills a slot the core does not have, so a typo can't drop rules silently.
 */
export function assemble({ core, profiles }) {
  const markers = new Set(
    [...core.matchAll(/^<!-- profile: (\S+) -->$/gm)].map((m) => m[1]),
  )
  for (const profile of profiles) {
    for (const id of profile.slots.keys()) {
      if (!markers.has(id))
        throw new Error(`profile ${profile.name} fills unknown slot "${id}"`)
    }
  }
  const body = core.replace(/^<!-- profile: (\S+) -->$/gm, (_, id) =>
    fillSlot({ id, profiles }),
  )
  const assembled = renumberChecklist(lf(body).replace(/\n{3,}/g, '\n\n'))
  return assembled.replace(/^<!-- contents -->$/m, () => contentsFor(assembled))
}

/**
 * Lists every numbered section with its subsections, linked by the anchors GitHub
 * and editors derive from the headings, so a reader or agent can jump to the rules
 * for the change at hand without reading the whole file.
 */
function contentsFor(text) {
  const lines = []
  for (const m of text.matchAll(/^(#{2,3}) (.+)$/gm)) {
    const [, level, title] = m
    const link = `[${title}](#${anchorFor(title)})`
    if (level === '##' && /^\d+\. /.test(title)) lines.push(`- ${link}`)
    else if (level === '###' && lines.length > 0)
      lines[lines.length - 1] += ` · ${link}`
  }
  return lines.join('\n')
}

// GitHub's heading anchor: lowercase, punctuation dropped, each space a hyphen.
function anchorFor(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9 _-]/g, '')
    .replace(/ /g, '-')
}

/** Parses a profile file: front matter (name, title, summary) and its slot blocks. */
export function parseProfile({ text, scope }) {
  const source = lf(text)
  const front = source.match(/^---\n([\s\S]*?)\n---\n/)
  const meta = {}
  if (front) {
    for (const line of front[1].split('\n')) {
      const kv = line.match(/^(\w+):\s*(.*)$/)
      if (kv) meta[kv[1]] = kv[2].trim()
    }
  }
  const slots = new Map()
  for (const m of source.matchAll(
    /^<!-- slot: (\S+) -->\n([\s\S]*?)\n<!-- \/slot -->$/gm,
  )) {
    if (slots.has(m[1]))
      throw new Error(`profile ${meta.name ?? '?'} fills slot "${m[1]}" twice`)
    slots.set(m[1], m[2].trim())
  }
  return {
    name: meta.name ?? 'local',
    title: meta.title ?? 'Local rules',
    scope,
    slots,
  }
}

function fillSlot({ id, profiles }) {
  const fills = profiles.filter((p) => p.slots.has(id))
  if (fills.length === 0) return ''
  if (fills.length === 1) return fills[0].slots.get(id)
  // A checklist slot holds list items, which a label line would break.
  if (id === '14') return fills.map((p) => p.slots.get(id)).join('\n')
  return fills.map((p) => `${labelFor(p)}\n\n${p.slots.get(id)}`).join('\n\n')
}

function labelFor(profile) {
  return profile.scope
    ? `**${profile.title}** (\`${profile.scope}\`):`
    : `**${profile.title}:**`
}

// §14 is one ordered list that profiles extend, so its numbers are reassigned.
function renumberChecklist(text) {
  const start = text.indexOf('\n## 14. ')
  if (start === -1) return text
  let n = 0
  const tail = text.slice(start).replace(/^\d+\. /gm, () => `${++n}. `)
  return text.slice(0, start) + tail
}

// ---- args, hashing, header ----

function parseArgs(argv) {
  const args = {
    check: false,
    dest: process.env.STANDARDS_DEST || process.cwd(),
    source: null,
  }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--check') args.check = true
    else if (argv[i] === '--dest') args.dest = argv[++i]
    else if (argv[i] === '--source') args.source = resolve(argv[++i])
  }
  args.dest = resolve(args.dest)
  return args
}

// Normalize line endings so hashing is CRLF- and autocrlf-insensitive.
function lf(text) {
  return text.replace(/\r\n/g, '\n')
}

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

function renderVendored({ body, version, shortSha, profileNames }) {
  const header =
    `<!--\n` +
    `  GENERATED — DO NOT EDIT.\n` +
    `  Source: ${CANONICAL_REPO} · standard/ (core + ${profileNames.join(', ')})\n` +
    `  Version: ${version} · commit: ${shortSha}\n` +
    `  Edit upstream (${CANONICAL_REPO}), or this repo's local profile, and re-run\n` +
    `  \`pnpm standards:sync\`. Local edits here are overwritten on the next sync.\n` +
    `-->\n\n`
  return header + body
}

// ---- config ----

function readConfig(dest) {
  const p = join(dest, CONFIG_FILE)
  const raw = existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : {}
  const profiles = (raw.profiles ?? DEFAULT_PROFILES).map((entry) =>
    typeof entry === 'string' ? { name: entry } : entry,
  )
  const local = []
    .concat(raw.local ?? [])
    .map((entry) => (typeof entry === 'string' ? { path: entry } : entry))
  return { profiles, local }
}

function readLocalProfiles({ dest, local }) {
  return local.map((entry) => {
    const text = readFileSync(join(dest, entry.path), 'utf8')
    return { entry, text, hash: `sha256:${sha256(text)}` }
  })
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

function viaGh() {
  return {
    head: () =>
      gh([
        `repos/${CANONICAL_REPO}/commits/${DEFAULT_BRANCH}`,
        '-q',
        '.sha',
      ]).trim(),
    file: (path, ref) =>
      gh([`repos/${CANONICAL_REPO}/contents/${path}?ref=${ref}`], {
        raw: true,
      }),
    lastCommit: (path, ref) => {
      const out = gh([
        `repos/${CANONICAL_REPO}/commits?path=${path}&sha=${ref}&per_page=1`,
        '-q',
        '.[0] | [.sha, .commit.committer.date] | @tsv',
      ]).trim()
      const [sha, date] = out.split('\t')
      return { sha, date }
    },
  }
}

function viaCheckout(dir) {
  const git = (args) =>
    execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8' }).trim()
  return {
    head: () => git(['rev-parse', 'HEAD']),
    file: (path) => readFileSync(join(dir, path), 'utf8'),
    lastCommit: (path) => {
      const [sha, date] = git([
        'log',
        '-1',
        '--format=%H%x09%cI',
        '--',
        path,
      ]).split('\t')
      return { sha, date }
    },
  }
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

function viaHttp() {
  const api = `https://api.github.com/repos/${CANONICAL_REPO}`
  return {
    head: async () =>
      (await httpGet(`${api}/commits/${DEFAULT_BRANCH}`, { json: true })).sha,
    file: (path, ref) =>
      httpGet(
        `https://raw.githubusercontent.com/${CANONICAL_REPO}/${ref}/${path}`,
      ),
    lastCommit: async (path, ref) => {
      const commits = await httpGet(
        `${api}/commits?path=${path}&sha=${ref}&per_page=1`,
        { json: true },
      )
      const c = Array.isArray(commits) && commits[0]
      return { sha: c && c.sha, date: c && c.commit.committer.date }
    },
  }
}

/**
 * Fetches the core, the named profiles, and VERSION at one main HEAD, plus the
 * newest commit that touched any of them: the SHA this consumer pins.
 */
async function fetchCanonical({ profiles, source }) {
  const paths = [
    CORE_PATH,
    ...profiles.map((p) => `${PROFILE_DIR}/${p.name}.md`),
  ]
  const attempt = async (source) => {
    const head = await source.head()
    if (!head) throw new Error('empty main HEAD SHA')
    const [core, version, ...profileTexts] = await Promise.all([
      source.file(CORE_PATH, head),
      source.file(VERSION_PATH, head),
      ...paths.slice(1).map((p) => source.file(p, head)),
    ])
    const touched = await Promise.all(
      paths.map((p) => source.lastCommit(p, head)),
    )
    const newest = touched.reduce((a, b) =>
      new Date(b.date) > new Date(a.date) ? b : a,
    )
    if (!newest.sha) throw new Error('no commit SHA for the standard')
    return {
      core,
      version: version.trim(),
      profileTexts,
      sha: newest.sha,
      shortSha: newest.sha.slice(0, 7),
    }
  }
  if (source) return attempt(viaCheckout(source))
  try {
    return await attempt(viaGh())
  } catch (ghErr) {
    try {
      return await attempt(viaHttp())
    } catch (httpErr) {
      const ghMsg = (ghErr.stderr || ghErr.message || '')
        .toString()
        .trim()
        .split('\n')[0]
      throw new Error(
        `Could not fetch the canonical standard from ${CANONICAL_REPO}.\n` +
          `  via gh:    ${ghMsg}\n` +
          `  via https: ${httpErr.message}\n` +
          `Check network access, or install/auth gh (\`gh api user\`).`,
      )
    }
  }
}

// ---- modes ----

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
        `This file is generated; edit upstream (${CANONICAL_REPO}) or the local profile, ` +
        `and re-run \`pnpm standards:sync\`.`,
    )
    process.exit(1)
  }
  const { local } = readConfig(dest)
  const recorded = meta.localHashes ?? {}
  for (const { entry, hash } of readLocalProfiles({ dest, local })) {
    if (recorded[entry.path] !== hash) {
      console.error(
        `standards:check FAILED — local profile ${entry.path} changed since the last sync.\n` +
          `Re-run \`pnpm standards:sync\` so ${STANDARD_PATH} includes it.`,
      )
      process.exit(1)
    }
  }
  console.log(
    `standards:check OK — vendored ${STANDARD_PATH} matches v${meta.version} (${meta.sha.slice(0, 7)}).`,
  )
}

async function runSync({ dest, source }) {
  const config = readConfig(dest)
  const { core, version, profileTexts, sha, shortSha } = await fetchCanonical({
    ...config,
    source,
  })
  const locals = readLocalProfiles({ dest, local: config.local })
  const profiles = [
    ...config.profiles.map((p, i) =>
      parseProfile({ text: profileTexts[i], scope: p.scope }),
    ),
    ...locals.map(({ entry, text }) =>
      parseProfile({ text, scope: entry.scope }),
    ),
  ]
  const body = assemble({ core, profiles })
  const expectedBodyHash = `sha256:${sha256(body)}`
  const localHashes = Object.fromEntries(
    locals.map(({ entry, hash }) => [entry.path, hash]),
  )
  const mdPath = join(dest, STANDARD_PATH)
  const local = readLocalMeta(dest)
  const currentBodyHash = existsSync(mdPath)
    ? `sha256:${sha256(stripHeader(readFileSync(mdPath, 'utf8')))}`
    : null

  // Skip only when the file is BOTH current (SHA matches) AND untampered (body
  // matches). A hand-edit or a changed local profile leaves the SHA equal but the
  // body hash different, so this still repairs it — sync is self-healing.
  if (local && local.sha === sha && currentBodyHash === expectedBodyHash) {
    console.log(
      `standards:sync — already up to date (v${version}, ${shortSha}). No changes.`,
    )
    return
  }

  const profileNames = profiles.map((p) => p.name)
  const meta = {
    version,
    sha,
    shortSha,
    profiles: profileNames,
    bodyHash: expectedBodyHash,
    localHashes,
    source: CANONICAL_REPO,
    syncedAt: new Date().toISOString(),
  }
  writeFileSync(
    mdPath,
    renderVendored({ body, version, shortSha, profileNames }),
  )
  writeFileSync(
    join(dest, '.standards-version'),
    JSON.stringify(meta, null, 2) + '\n',
  )

  let action
  if (!local) action = `wrote v${version} (${shortSha})`
  else if (local.sha !== sha) action = `updated ${local.shortSha} → ${shortSha}`
  else action = `rebuilt (v${version}, ${shortSha})`
  console.log(
    `standards:sync — ${action} with ${profileNames.join(' + ')} in ${dest}.`,
  )
}

if (isMain()) {
  try {
    const { check, dest, source } = parseArgs(process.argv.slice(2))
    if (check) runCheck(dest)
    else await runSync({ dest, source })
  } catch (err) {
    console.error(err.message || err)
    process.exit(1)
  }
}

// True when this file is the script node was asked to run, not a module that
// build.mjs imported. Compare real paths: node resolves symlinks for the main
// module, so on macOS a run from /var/folders/… loads /private/var/folders/….
function isMain() {
  if (!process.argv[1]) return false
  try {
    return realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)
  } catch {
    return false
  }
}
