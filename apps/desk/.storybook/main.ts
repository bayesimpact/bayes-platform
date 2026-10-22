import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import type { StorybookConfig } from "@storybook/react-vite"
import type { Plugin } from "vite"

const workerPath = fileURLToPath(import.meta.resolve("msw/mockServiceWorker.js"))

/**
 * Serves MSW's worker at the root of Storybook, whose pages it must control, and ships it with a
 * built Storybook.
 */
function mockServiceWorker(): Plugin {
  return {
    name: "desk-storybook-mock-service-worker",
    configureServer(server) {
      server.middlewares.use("/mockServiceWorker.js", (_request, response) => {
        response.setHeader("Content-Type", "text/javascript")
        response.end(readFileSync(workerPath))
      })
    },
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "mockServiceWorker.js",
        source: readFileSync(workerPath),
      })
    },
  }
}

// The domain a worktree environment serves its Storybooks on, which it hands to Vite this way.
const environmentDomain = process.env.__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.tsx"],
  // An MCP server at /mcp, for agents to list the stories and read their components.
  addons: ["@storybook/addon-mcp"],
  framework: "@storybook/react-vite",
  features: { componentsManifest: true },
  // The default theme, where the Desk reads it: under its base.
  staticDirs: [{ from: "../public", to: "/app" }],
  core: {
    disableTelemetry: true,
    allowedHosts: [".connect.localhost", ...(environmentDomain ? [environmentDomain] : [])],
  },
  // The stories run on the MSW handlers with no sign-in: the `mock` mode of src/app/config.ts.
  viteFinal: (viteConfig) => ({
    ...viteConfig,
    mode: "mock",
    plugins: [...(viteConfig.plugins ?? []), mockServiceWorker()],
  }),
}

export default config
