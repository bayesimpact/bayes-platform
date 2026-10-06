#!/usr/bin/env node
// Screenshots one Storybook story with a headless Chromium and reports what went wrong on the
// page (console errors and warnings, uncaught exceptions, failed requests).
//
// Playwright is not a dependency of the repo. It is installed once, outside the repo, in
// TOOL_DIR, and never added to a package.json.
//
//   node screenshot.mjs --story routes-studio-project-membership--default \
//     --args "withMemberAgents:!true" --lang fr,en --out /tmp/shots
//
// Run with --help for every option.
import { execFileSync } from "node:child_process"
import { mkdirSync } from "node:fs"
import { createRequire } from "node:module"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { parseArgs } from "node:util"

// Matches the Chromium build most often already cached in ~/.cache/ms-playwright (chromium-1194).
const PLAYWRIGHT_VERSION = "1.56.1"
const TOOL_DIR =
  process.env.STORYBOOK_SCREENSHOT_TOOL_DIR ?? join(tmpdir(), "storybook-screenshot-tool")

const { values: options } = parseArgs({
  options: {
    story: { type: "string" },
    args: { type: "string", default: "" },
    globals: { type: "string", default: "" },
    lang: { type: "string", default: "fr" },
    port: { type: "string", default: "6006" },
    width: { type: "string", default: "1400" },
    height: { type: "string", default: "900" },
    "full-page": { type: "boolean", default: false },
    "wait-for": { type: "string" },
    wait: { type: "string", default: "1500" },
    out: { type: "string", default: "." },
    name: { type: "string" },
    help: { type: "boolean", default: false },
  },
})

if (options.help || !options.story) {
  console.log(`Usage: node screenshot.mjs --story <story-id> [options]

  --story      Story id, e.g. routes-studio-project-membership--default (from /index.json)
  --args       Story args, Storybook URL syntax: "role:owner;withAgents:!true;count:3"
  --globals    Storybook globals, same syntax
  --lang       Comma-separated languages, one screenshot each (default: fr)
  --port       Storybook port (default: 6006)
  --width      Viewport width (default: 1400)
  --height     Viewport height (default: 900)
  --full-page  Capture the whole scrollable page instead of the viewport
  --wait-for   CSS or Playwright selector to wait for before the capture
  --wait       Extra milliseconds to wait after load (default: 1500)
  --out        Output directory (default: current directory)
  --name       File name prefix (default: the story id); set it per case so runs with other
               args or widths do not overwrite each other`)
  process.exit(options.help ? 0 : 1)
}

function loadPlaywright() {
  const requireFromTool = createRequire(join(TOOL_DIR, "package.json"))
  try {
    return requireFromTool("playwright")
  } catch {
    console.error(`Installing playwright@${PLAYWRIGHT_VERSION} in ${TOOL_DIR} (one-time)...`)
    mkdirSync(TOOL_DIR, { recursive: true })
    execFileSync(
      "npm",
      [
        "install",
        "--prefix",
        TOOL_DIR,
        "--no-save",
        "--no-audit",
        "--no-fund",
        "--silent",
        `playwright@${PLAYWRIGHT_VERSION}`,
      ],
      { stdio: "inherit" },
    )
    return requireFromTool("playwright")
  }
}

const { chromium } = loadPlaywright()
const baseUrl = `http://localhost:${options.port}`

let browser
try {
  browser = await chromium.launch()
} catch (error) {
  if (String(error).includes("Executable doesn't exist")) {
    console.error(
      `Chromium is missing for playwright@${PLAYWRIGHT_VERSION}. Install it once with:\n` +
        `  npx --prefix ${TOOL_DIR} playwright install chromium`,
    )
    process.exit(1)
  }
  throw error
}

const outDir = resolve(options.out)
mkdirSync(outDir, { recursive: true })
let problemCount = 0

for (const language of options.lang.split(",").map((value) => value.trim())) {
  const page = await browser.newPage({
    viewport: { width: Number(options.width), height: Number(options.height) },
    locale: language,
  })
  // The app's i18next language detector reads localStorage first.
  await page.addInitScript((lng) => localStorage.setItem("i18nextLng", lng), language)

  const problems = []
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") {
      problems.push(`console.${message.type()}: ${message.text()}`)
    }
  })
  page.on("pageerror", (error) => problems.push(`uncaught: ${error.message}`))
  page.on("response", (response) => {
    if (response.status() >= 400) problems.push(`HTTP ${response.status()}: ${response.url()}`)
  })
  page.on("requestfailed", (request) => {
    const errorText = request.failure()?.errorText ?? ""
    // Aborted requests come from navigations and Vite reloads, not from the page under test.
    if (errorText.includes("ERR_ABORTED")) return
    problems.push(`request failed: ${request.url()} (${errorText})`)
  })

  const query = new URLSearchParams({ id: options.story, viewMode: "story" })
  if (options.args) query.set("args", options.args)
  if (options.globals) query.set("globals", options.globals)
  // Storybook expects ":" and ";" unescaped in args and globals.
  const url = `${baseUrl}/iframe.html?${query.toString().replaceAll("%3A", ":").replaceAll("%3B", ";").replaceAll("%21", "!")}`

  await page.goto(url, { waitUntil: "networkidle" })
  if (options["wait-for"]) await page.waitForSelector(options["wait-for"], { timeout: 15000 })
  await page.waitForTimeout(Number(options.wait))

  // Storybook renders its own error screen when the story throws or does not exist.
  const storybookError = await page
    .locator(".sb-errordisplay:visible, .sb-nopreview:visible")
    .first()
    .innerText({ timeout: 500 })
    .catch(() => null)
  if (storybookError)
    problems.push(`storybook error screen: ${storybookError.split("\n").slice(0, 3).join(" | ")}`)

  // Content wider than the viewport is clipped, even with --full-page, and logs no error.
  const overflow = await page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth
    const overflowing = [...document.querySelectorAll("body *")]
      .map((element) => ({ element, right: Math.round(element.getBoundingClientRect().right) }))
      .filter(
        ({ element, right }) => right > viewportWidth + 1 && element.getClientRects().length > 0,
      )
      // Keep the outermost offenders: their descendants overflow only because they do.
      .filter(
        ({ element }, _, all) =>
          !all.some(
            (other) =>
              other.element !== element &&
              other.element.contains(element) &&
              other.right >= element.getBoundingClientRect().right,
          ),
      )
      .map(({ element, right }) => {
        const text = (element.innerText || element.getAttribute("aria-label") || "")
          .trim()
          .split("\n")[0]
          .slice(0, 60)
        return `ends at ${right}px${text ? ` "${text}"` : ""}`
      })
    // Wrappers of the same content report the same line, so keep one of each.
    return { viewportWidth, overflowing: [...new Set(overflowing)].slice(0, 5) }
  })
  if (overflow.overflowing.length > 0) {
    problems.push(
      `horizontal overflow beyond the ${overflow.viewportWidth}px viewport: ${overflow.overflowing.join("; ")}`,
    )
  }

  const file = join(outDir, `${options.name ?? options.story}.${language}.png`)
  await page.screenshot({ path: file, fullPage: options["full-page"] })
  console.log(`screenshot: ${file}`)
  console.log(`url: ${url}`)
  // First line only: stack traces would drown the report.
  for (const problem of problems) console.log(`  ${problem.split("\n")[0].slice(0, 300)}`)
  if (problems.length === 0) console.log("  no console errors, page errors or failed requests")
  problemCount += problems.length
  await page.close()
}

await browser.close()
process.exit(problemCount > 0 ? 2 : 0)
