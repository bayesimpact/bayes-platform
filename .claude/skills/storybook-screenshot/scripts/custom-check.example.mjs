// Template for a check screenshot.mjs does not cover: interact with a story, then measure or
// capture. Copy it to your scratchpad, edit the marked part, and run it with node.
//
//   node <scratchpad>/custom-check.mjs <port> <story-id> <out-dir> [lang]
import { createRequire } from "node:module"
import { tmpdir } from "node:os"
import { join } from "node:path"

// Same Playwright install as screenshot.mjs: run screenshot.mjs once to create it.
const toolDir =
  process.env.STORYBOOK_SCREENSHOT_TOOL_DIR ?? join(tmpdir(), "storybook-screenshot-tool")
const { chromium } = createRequire(join(toolDir, "package.json"))("playwright")

const [
  port = "6006",
  storyId = "routes-studio-project-documents--with-data",
  outDir = tmpdir(),
  language = "fr",
] = process.argv.slice(2)

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1400, height: 900 }, locale: language })
// The app's i18next language detector reads localStorage first.
await page.addInitScript((lng) => localStorage.setItem("i18nextLng", lng), language)
page.on("console", (message) => {
  if (message.type() === "error") console.log(`console.error: ${message.text().split("\n")[0]}`)
})
await page.goto(`http://localhost:${port}/iframe.html?id=${storyId}&viewMode=story`, {
  waitUntil: "networkidle",
})

// --- Edit from here: interact, then measure or capture. ---
await page.getByRole("button").first().hover()
const boxes = await page
  .locator("table")
  .evaluateAll((tables) => tables.map((table) => table.getBoundingClientRect().toJSON()))
console.log(JSON.stringify(boxes))
await page.screenshot({ path: join(outDir, `${storyId}.custom.${language}.png`) })
// --- To here. ---

await browser.close()
