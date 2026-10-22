#!/usr/bin/env node
// build.mjs — builds the canonical repo's root CODING_STANDARDS.md (the core plus
// the tanstack-start profile) from standard/, and checks every profile assembles.
//
// The root file is what consumers on the pre-profile runner fetch, and what a reader
// browsing this repo sees. It is build output: edit standard/, then run this.
//
//   node scripts/build.mjs           rebuild CODING_STANDARDS.md
//   node scripts/build.mjs --check   fail if CODING_STANDARDS.md is stale, or any
//                                    profile fails to assemble against the core

import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { assemble, parseProfile } from './standards-sync.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'CODING_STANDARDS.md')
const NOTE =
  '<!-- Built from standard/core.md + standard/profiles/tanstack-start.md by\n' +
  '     scripts/build.mjs. Edit those files, not this one. -->\n\n'

const core = readFileSync(join(ROOT, 'standard/core.md'), 'utf8')
const profileDir = join(ROOT, 'standard/profiles')
const loadProfile = (name) =>
  parseProfile({ text: readFileSync(join(profileDir, `${name}.md`), 'utf8') })

// Past this many lines, retro-style reviews ask for navigation pointers, and every
// review that reads the whole file pays for its length.
const LINE_BUDGET = 1000

// Every profile must assemble on its own; assemble() throws on an unknown slot.
for (const file of readdirSync(profileDir).filter((f) => f.endsWith('.md'))) {
  const name = file.replace(/\.md$/, '')
  const lines = assemble({ core, profiles: [loadProfile(name)] }).split('\n').length
  const over = lines > LINE_BUDGET ? `  (warning: over the ${LINE_BUDGET}-line budget)` : ''
  console.log(`  ${name.padEnd(16)} ${String(lines).padStart(5)} lines${over}`)
}

const built = NOTE + assemble({ core, profiles: [loadProfile('tanstack-start')] })

if (process.argv.includes('--check')) {
  if (readFileSync(OUT, 'utf8') !== built) {
    console.error('CODING_STANDARDS.md is stale: run `node scripts/build.mjs` and commit it.')
    process.exit(1)
  }
  console.log('build:check OK — CODING_STANDARDS.md matches standard/, and every profile assembles.')
} else {
  writeFileSync(OUT, built)
  console.log('build — wrote CODING_STANDARDS.md (core + tanstack-start).')
}
