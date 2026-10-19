#!/usr/bin/env node
/**
 * Vendors the Bayes design system into the help center.
 *
 * The site chrome of the help center (header, footer, page layout) is the Bayes
 * Impact one, shared with bayesimpact.org and the decks. Its source of truth is the
 * `bayesimpact/website` repo: `packages/ui` (@bayes/ui: tokens, fonts, the components
 * and document layers) and `packages/brand` (@bayes/brand: the marks). This repo cannot
 * depend on that private monorepo, so the files are copied here and committed. Never
 * edit them by hand: change them in `website`, then run this script.
 *
 *   node scripts/sync-bayes-ui.mjs          # copy from the website clone
 *   node scripts/sync-bayes-ui.mjs --check  # fail if the vendored copy is stale
 *
 * The website clone is found at WEBSITE_REPO_DIR, or at `../website` next to this
 * repo. Files are read from WEBSITE_REF (default `origin/main`) with `git show`, so a
 * clone checked out on another branch, or with local edits, vendors what is merged.
 *
 * Stylesheets are vendored without their comments: the website repo is private and its
 * comments name internal work, while this repo is public. Each one gets a header saying
 * where it comes from instead.
 */
import { execFileSync } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const appDir = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const repoRoot = resolve(appDir, "../..")
const websiteDir = resolve(process.env.WEBSITE_REPO_DIR || join(repoRoot, "../website"))
const ref = process.env.WEBSITE_REF || "origin/main"
const check = process.argv.includes("--check")

const fonts = [
  "archivo-latin-ext.woff2",
  "archivo-latin.woff2",
  "archivo-narrow-latin-ext.woff2",
  "archivo-narrow-latin.woff2",
  "inter-latin-ext.woff2",
  "inter-latin.woff2",
  "kaisei-decol-400-latin-ext.woff2",
  "kaisei-decol-400-latin.woff2",
  "kaisei-decol-500-latin-ext.woff2",
  "kaisei-decol-500-latin.woff2",
  "kaisei-decol-700-latin-ext.woff2",
  "kaisei-decol-700-latin.woff2",
]

// [source path in website, destination path in apps/help]
const files = [
  ["packages/ui/tokens.css", "src/vendor/bayes-ui/tokens.css"],
  ["packages/ui/fonts.css", "src/vendor/bayes-ui/fonts.css"],
  ["packages/ui/components.css", "src/vendor/bayes-ui/components.css"],
  ["packages/ui/lang-switcher.css", "src/vendor/bayes-ui/lang-switcher.css"],
  ["packages/ui/document.css", "src/vendor/bayes-ui/document.css"],
  // The site's own document-page layer (/platform, /sectors): section heads, .dp bands.
  ["src/styles/doc-page.css", "src/vendor/bayes-ui/doc-page.css"],
  ...fonts.map((f) => [`packages/ui/assets/fonts/${f}`, `src/vendor/bayes-ui/assets/fonts/${f}`]),
  ["packages/brand/logos/bi-colors.svg", "public/brand/bi-colors.svg"],
  ["packages/brand/logos/bi-black.svg", "public/brand/bi-black.svg"],
  ["packages/brand/logos/bi-icon-colors.svg", "public/brand/bi-icon-colors.svg"],
]

if (!existsSync(join(websiteDir, ".git"))) {
  console.error(`No website clone at ${websiteDir}. Set WEBSITE_REPO_DIR.`)
  process.exit(1)
}

const stale = []
let written = 0
const stripComments = (css) =>
  css
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()

for (const [src, dest] of files) {
  let content = execFileSync("git", ["-C", websiteDir, "show", `${ref}:${src}`], {
    maxBuffer: 16 * 1024 * 1024,
  })
  if (src.endsWith(".css")) {
    const header = `/* Vendored from bayesimpact/website ${src} by scripts/sync-bayes-ui.mjs. Do not edit. */`
    content = Buffer.from(`${header}\n${stripComments(content.toString())}\n`)
  }
  const target = join(appDir, dest)
  const current = existsSync(target) ? readFileSync(target) : null
  if (current?.equals(content)) continue
  if (check) {
    stale.push(dest)
    continue
  }
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, content)
  written++
}

const sha = execFileSync("git", ["-C", websiteDir, "rev-parse", "--short", ref]).toString().trim()
if (check) {
  if (stale.length) {
    console.error(`${stale.length} vendored file(s) differ from website ${ref} (${sha}):`)
    for (const f of stale) console.error(`  ${f}`)
    console.error("Run: node scripts/sync-bayes-ui.mjs")
    process.exit(1)
  }
  console.log(`${files.length} vendored files match website ${ref} (${sha}).`)
} else {
  console.log(`${written} of ${files.length} vendored files updated from website ${ref} (${sha}).`)
}
