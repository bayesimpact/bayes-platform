import fs from "node:fs"
import path from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import type { Plugin } from "vite"
import { defineConfig } from "vite"

const certsDir = path.resolve(__dirname, "../api/.certs")

/**
 * Serves the built launcher IIFE at /launcher.js during `vite dev`.
 * Run `npm run build:launcher` once to produce dist-launcher/launcher.js,
 * then the dev server will pick it up automatically.
 */
function serveBuiltLauncher(): Plugin {
  const launcherPath = path.resolve(__dirname, "dist-launcher/launcher.js")
  return {
    name: "serve-built-launcher",
    configureServer(server) {
      server.middlewares.use("/launcher.js", (_req, res) => {
        res.setHeader("Content-Type", "application/javascript; charset=utf-8")
        // Vite lib IIFE format appends `.iife.js` — look for that first, fall back to plain `.js`
        const candidates = [
          path.resolve(__dirname, "dist-launcher/launcher.iife.js"),
          path.resolve(__dirname, "dist-launcher/launcher.js"),
        ]
        const builtFile = candidates.find((candidate) => fs.existsSync(candidate))
        if (builtFile) {
          res.end(fs.readFileSync(builtFile, "utf-8"))
        } else {
          res.end(
            `console.warn("[AgentStudio] launcher.js not built yet. Run: npm run build:launcher")`,
          )
        }
      })
    },
  }
}

// SPA build — served inside the iframe
export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [["babel-plugin-react-compiler"]],
      },
    }),
    tailwindcss(),
    serveBuiltLauncher(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@caseai-connect/api-contracts": path.resolve(
        __dirname,
        "../../packages/api-contracts/src/index.ts",
      ),
    },
  },
  server: {
    port: 5175,
    https: fs.existsSync(path.join(certsDir, "key.pem"))
      ? {
          key: fs.readFileSync(path.join(certsDir, "key.pem")),
          cert: fs.readFileSync(path.join(certsDir, "cert.pem")),
        }
      : undefined,
    allowedHosts: ["connect.localhost"],
  },
  preview: {
    port: 5176,
    https: fs.existsSync(path.join(certsDir, "key.pem"))
      ? {
          key: fs.readFileSync(path.join(certsDir, "key.pem")),
          cert: fs.readFileSync(path.join(certsDir, "cert.pem")),
        }
      : undefined,
    allowedHosts: ["connect.localhost"],
  },
})
