import fs from "node:fs"
import path from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig, loadEnv } from "vite"

const certsDir = path.resolve(__dirname, "../api/.certs")

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, "")
  const appTitle = env.VITE_APP_TITLE?.trim() || "AgentStudio"

  const httpsConfig = fs.existsSync(path.join(certsDir, "key.pem"))
    ? {
        key: fs.readFileSync(path.join(certsDir, "key.pem")),
        cert: fs.readFileSync(path.join(certsDir, "cert.pem")),
      }
    : undefined

  return {
    plugins: [
      react({
        babel: {
          plugins: [["babel-plugin-react-compiler"]],
        },
      }),
      tailwindcss(),
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
        "@caseai-connect/api-contracts": path.resolve(
          __dirname,
          "../../packages/api-contracts/src/index.ts",
        ),
      },
    },
    server: {
      port: Number(env.FRONT_PORT) || 5173,
      https: httpsConfig,
      allowedHosts: ["connect.localhost"],
    },
    // `vite preview` serves the production build locally. Same HTTPS certs
    // and host as `server` so Auth0 callbacks (configured against
    // connect.localhost) keep working when validating prod builds locally.
    // Port 5174 so dev (5173) and preview can run together.
    preview: {
      port: Number(env.FRONT_PREVIEW_PORT) || 5174,
      https: httpsConfig,
      allowedHosts: ["connect.localhost"],
    },
  }
})
