#!/usr/bin/env node
import { INSTALL_USAGE, parseInstallArgs } from "./args"
import { runAppsInstall } from "./install"
import { openBrowser } from "./open-browser"

async function main(): Promise<void> {
  const parsed = parseInstallArgs(process.argv.slice(2), process.env)
  if (parsed.kind === "help") {
    process.stdout.write(INSTALL_USAGE)
    return
  }
  if (parsed.kind === "error") {
    process.stderr.write(`${parsed.message}`)
    process.exitCode = 1
    return
  }

  process.exitCode = await runAppsInstall({
    slug: parsed.slug,
    frontendOrigin: parsed.frontendOrigin,
    color: process.stdout.isTTY === true,
    openUrl: openBrowser,
    write: (text) => process.stdout.write(text),
    writeError: (text) => process.stderr.write(text),
  })
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Install failed"
  process.stderr.write(`${message}\n`)
  process.exitCode = 1
})
