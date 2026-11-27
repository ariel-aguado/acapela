#!/usr/bin/env node
// Builds every Bible version found in data/biblias/ into public/bibles/
// (one <id>.<hash8>.sqlite + <id>.books.json each, plus manifest.json), with
// scripts/build-bible-db.mjs — the same pipeline as SúperBiblia, so the
// files are interchangeable.
//
// - A version whose source file is missing is skipped and taken out of the
//   manifest: a clone without the Bible data still builds and runs (the
//   app simply offers no versions).
// - A version already built from the same source is not rebuilt (building
//   the full-text index takes a few seconds per version), unless --force.
//
// Run automatically via `prebuild` and `predev`. Manual run:
//   node scripts/build-bibles.mjs [--force]

import { spawnSync } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs"
import path from "node:path"
import process from "node:process"

const VERSIONS = [
  { id: "rvr1960", label: "Reina-Valera 1960" },
  { id: "nvi1999", label: "Nueva Versión Internacional 1999" },
  { id: "lbla", label: "La Biblia de las Américas" },
  { id: "dhh", label: "Dios Habla Hoy" },
]

const root = process.cwd()
const outDir = path.join(root, "public/bibles")
const manifestPath = path.join(outDir, "manifest.json")
const force = process.argv.includes("--force")

function readManifest() {
  if (!existsSync(manifestPath))
    return { versions: [] }
  return JSON.parse(readFileSync(manifestPath, "utf8"))
}

function writeManifest(manifest) {
  mkdirSync(outDir, { recursive: true })
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))
}

function isUpToDate(version, input) {
  const entry = readManifest().versions.find(v => v.id === version.id)
  if (!entry || entry.label !== version.label)
    return false
  if (!existsSync(path.join(outDir, entry.file)) || !existsSync(path.join(outDir, `${version.id}.books.json`)))
    return false
  return statSync(input).mtimeMs < Date.parse(entry.builtAt)
}

let built = 0
for (const version of VERSIONS) {
  const input = path.join(root, "data/biblias", `${version.id}.sqlite`)
  if (!existsSync(input)) {
    const manifest = readManifest()
    if (manifest.versions.some(v => v.id === version.id)) {
      manifest.versions = manifest.versions.filter(v => v.id !== version.id)
      writeManifest(manifest)
    }
    console.warn(`[build-bibles] sin ${path.relative(root, input)}: ${version.label} no se ofrece`)
    continue
  }
  if (!force && isUpToDate(version, input)) {
    console.log(`[build-bibles] ${version.id} al día`)
    continue
  }
  const result = spawnSync(process.execPath, [
    "scripts/build-bible-db.mjs",
    "--input",
    path.relative(root, input),
    "--id",
    version.id,
    "--label",
    version.label,
  ], { stdio: "inherit" })
  if (result.status !== 0)
    process.exit(result.status ?? 1)
  built++
}

// Same order as VERSIONS (the first is the default), whatever order they
// were built in.
const manifest = readManifest()
manifest.versions.sort((a, b) => VERSIONS.findIndex(v => v.id === a.id) - VERSIONS.findIndex(v => v.id === b.id))
writeManifest(manifest)
console.log(`[build-bibles] ${manifest.versions.length} versiones en el manifest (${built} reconstruidas)`)
