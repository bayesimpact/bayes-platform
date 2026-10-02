#!/usr/bin/env node
// Loads a harness page in headless Chromium and reports what happened.
// Usage: node harness/probe.mjs [options]   (the harness must be running, see SKILL.md)
//
//   --path <path>        page to open (default: /harness, the scenario's own page)
//   --query <qs>         harness parameters, e.g. "delays=agentSettings.getAll:1500&strict=1"
//   --runs <n>           number of cold loads (default 1)
//   --wait <ms>          time to wait before the final snapshot (default 3000)
//   --at <ms,ms>         extra snapshot times, e.g. "900" to look at a loading state
//   --selector <css>     elements whose text each snapshot prints (e.g. "tbody tr")
//   --screenshot <dir>   save a full-page PNG per snapshot
//   --calls              print the service call log
//   --tree               print the React component tree (dev server only)
//   --base <url>         harness origin (default http://localhost:5198)
//
// Exits 1 when any run crashed, so it can drive a before/after comparison.
import { existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { homedir } from "node:os"
import path from "node:path"
import { parseArgs } from "node:util"

const { values: options } = parseArgs({
  options: {
    path: { type: "string", default: "/harness" },
    query: { type: "string", default: "" },
    runs: { type: "string", default: "1" },
    wait: { type: "string", default: "3000" },
    at: { type: "string", default: "" },
    selector: { type: "string" },
    screenshot: { type: "string" },
    calls: { type: "boolean", default: false },
    tree: { type: "boolean", default: false },
    base: { type: "string", default: "http://localhost:5198" },
  },
})

// playwright-core is not a repo dependency: use PLAYWRIGHT_CORE, a local install, or the npx cache.
function playwrightCandidates() {
  const candidates = []
  if (process.env.PLAYWRIGHT_CORE) candidates.push(process.env.PLAYWRIGHT_CORE)
  try {
    candidates.push(
      path.dirname(createRequire(import.meta.url).resolve("playwright-core/package.json")),
    )
  } catch {}
  const npxCache = path.join(homedir(), ".npm", "_npx")
  if (existsSync(npxCache)) {
    for (const entry of readdirSync(npxCache)) {
      const directory = path.join(npxCache, entry, "node_modules", "playwright-core")
      if (existsSync(directory)) candidates.push(directory)
    }
  }
  return candidates
}

async function launchBrowser() {
  for (const directory of playwrightCandidates()) {
    const { version } = JSON.parse(readFileSync(path.join(directory, "package.json"), "utf8"))
    const { chromium } = createRequire(import.meta.url)(directory)
    try {
      return { browser: await chromium.launch(), version }
    } catch {
      // This playwright-core version has no matching Chromium installed; try the next one.
    }
  }
  console.error(
    "No usable playwright-core + Chromium found. Run: npx -y playwright-core@1.56.0 install chromium",
  )
  process.exit(2)
}

async function snapshot(page, label) {
  const info = await page.evaluate((selector) => {
    const body = document.body.innerText
    return {
      url: window.location.pathname + window.location.search,
      crashed: body.includes("Unexpected Application Error"),
      text: body.replace(/\s+/g, " ").slice(0, 300),
      selected: selector
        ? [...document.querySelectorAll(selector)].map((element) =>
            element.innerText.replace(/\s+/g, " ").trim().slice(0, 200),
          )
        : undefined,
      missingFixtures: [...(window.__harness?.missingFixtures ?? [])],
    }
  }, options.selector)
  if (options.screenshot) {
    mkdirSync(options.screenshot, { recursive: true })
    const file = path.join(options.screenshot, `${label}.png`)
    await page.screenshot({ path: file, fullPage: true })
    info.screenshot = file
  }
  return info
}

function componentTree() {
  const root = document.getElementById("root")
  const key = Object.keys(root).find((name) => name.startsWith("__reactContainer"))
  const lines = []
  const walk = (fiber, depth) => {
    for (let node = fiber; node; node = node.sibling) {
      const name = typeof node.type === "string" ? null : node.type?.displayName || node.type?.name
      if (name) lines.push(`${" ".repeat(depth)}${name}`)
      if (depth < 150) walk(node.child, depth + 1)
    }
  }
  walk(root[key], 0)
  return lines.join("\n")
}

const { browser, version } = await launchBrowser()
const separator = options.path.includes("?") ? "&" : "?"
const url = `${options.base}${options.path}${options.query ? separator + options.query : ""}`
const snapshotTimes = options.at
  .split(",")
  .filter(Boolean)
  .map(Number)
  .sort((a, b) => a - b)
console.log(`playwright-core ${version}, ${url}`)

let crashes = 0
for (let run = 0; run < Number(options.runs); run++) {
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } })
  const errors = []
  page.on("pageerror", (error) => errors.push(error.message))
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text().split("\n")[0].slice(0, 300))
  })
  await page.goto(url)

  const snapshots = {}
  let elapsed = 0
  for (const time of [...snapshotTimes, Number(options.wait)]) {
    if (time > elapsed) await page.waitForTimeout(time - elapsed)
    elapsed = Math.max(elapsed, time)
    snapshots[`${elapsed}ms`] = await snapshot(page, `run${run}-${elapsed}ms`)
  }

  const final = snapshots[`${elapsed}ms`]
  const crashed = final.crashed || errors.some((error) => error.includes("Uncaught"))
  if (crashed) crashes++
  console.log(JSON.stringify({ run, crashed, errors: [...new Set(errors)], snapshots }, null, 1))
  if (options.calls) console.log((await page.evaluate(() => window.__harness.calls)).join("\n"))
  if (options.tree) console.log(await page.evaluate(componentTree))
  await page.close()
}

console.log(`crashes: ${crashes}/${options.runs}`)
await browser.close()
process.exit(crashes > 0 ? 1 : 0)
