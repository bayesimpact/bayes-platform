import fs from "node:fs"
import path from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig, loadEnv, type Plugin } from "vite"
// By path, not by package name: Vite leaves a package out of the bundle of this file, and Node
// would then load its TypeScript source as it is.
import {
  MCP_APP_SANDBOX_PATH,
  servedSandboxPage,
} from "../../packages/mcp-app-host/src/sandbox-page"

const certsDir = path.resolve(__dirname, "../api/.certs")

/**
 * Publishes the page of the sandbox of MCP App cards beside the app, at `MCP_APP_SANDBOX_PATH`:
 * a file of the build, and a route of `vite dev`. The install points its sandbox origin
 * (`mcpAppSandboxOrigin` of the runtime configuration) at this build, and lets that origin serve
 * this one path. The page comes from the package every host shares, so the frame a host talks to
 * and the page it loads cannot drift apart. It is served with no Content Security Policy: every
 * card would inherit it.
 */
function mcpAppSandboxPage(): Plugin {
  return {
    name: "mcp-app-sandbox-page",
    configureServer(server) {
      server.middlewares.use(MCP_APP_SANDBOX_PATH, (_request, response) => {
        response.setHeader("Content-Type", "text/html; charset=utf-8")
        response.setHeader("Cache-Control", "no-cache")
        response.setHeader("X-Content-Type-Options", "nosniff")
        response.end(servedSandboxPage())
      })
    },
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: MCP_APP_SANDBOX_PATH.slice(1),
        source: servedSandboxPage(),
      })
    },
  }
}

/**
 * The domain every label of a sandbox origin sits under, such as `local.example.org` for
 * `https://{label}.local.example.org`, or `undefined` when the template gives none: the dev
 * server then accepts no sandbox host, and the app says why a card cannot load.
 */
function sandboxDomainOf(template: string | undefined): string | undefined {
  const candidate = template?.trim().replaceAll("{label}", "label")
  if (!candidate || !URL.canParse(candidate)) return undefined
  const [, ...domain] = new URL(candidate).hostname.split(".")
  return domain.length > 0 ? domain.join(".") : undefined
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, "")
  const appTitle = env.VITE_APP_TITLE?.trim() || "AgentStudio"

  // The dev server answers the sandbox origin of MCP App cards too, for the sandbox page: every
  // label of that origin's domain is a host it must accept.
  const sandboxDomain = sandboxDomainOf(env.VITE_MCP_APP_SANDBOX_ORIGIN)
  const allowedHosts = ["connect.localhost", ...(sandboxDomain ? [`.${sandboxDomain}`] : [])]

  const httpsConfig = fs.existsSync(path.join(certsDir, "key.pem"))
    ? {
        key: fs.readFileSync(path.join(certsDir, "key.pem")),
        cert: fs.readFileSync(path.join(certsDir, "cert.pem")),
      }
    : undefined

  return {
    // Public path of the SPA. `/` for `vite dev` and the static hosting builds,
    // `/app/` when the API serves the build (the `app-runtime` image). Fixed at
    // build time on purpose: a property of the image, not of the tenant.
    base: env.VITE_BASE_PATH?.trim() || "/",
    plugins: [
      react({
        babel: {
          plugins: [["babel-plugin-react-compiler"]],
        },
      }),
      tailwindcss(),
      mcpAppSandboxPage(),
      {
        name: "inject-app-title",
        transformIndexHtml(html) {
          return html.replace("__APP_TITLE__", appTitle)
        },
      },
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
        "@bayes-platform/api-contracts": path.resolve(
          __dirname,
          "../../packages/api-contracts/src/index.ts",
        ),
      },
    },
    server: {
      port: Number(env.FRONT_PORT) || 5173,
      https: httpsConfig,
      allowedHosts,
    },
    // `vite preview` serves the production build locally. Same HTTPS certs
    // and host as `server` so OIDC callbacks (configured against
    // connect.localhost) keep working when validating prod builds locally.
    // Port 5174 so dev (5173) and preview can run together.
    preview: {
      port: Number(env.FRONT_PREVIEW_PORT) || 5174,
      https: httpsConfig,
      allowedHosts,
    },
  }
})
