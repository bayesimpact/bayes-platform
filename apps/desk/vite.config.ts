/// <reference types="vitest/config" />
import { existsSync, readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { lingui } from "@lingui/vite-plugin"
import tailwindcss from "@tailwindcss/vite"
import { tanstackRouter } from "@tanstack/router-plugin/vite"
import react from "@vitejs/plugin-react"
import { defineConfig, loadEnv } from "vite"

// The local certificates of the API, which serve connect.localhost over HTTPS when they exist.
const certsDirectory = fileURLToPath(new URL("../api/.certs/", import.meta.url))

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, import.meta.dirname, "")
  const https = existsSync(`${certsDirectory}key.pem`)
    ? {
        key: readFileSync(`${certsDirectory}key.pem`),
        cert: readFileSync(`${certsDirectory}cert.pem`),
      }
    : undefined
  // The Desk calls /api on its own origin: in dev, Vite forwards it to the local API.
  const proxy = {
    "/api": {
      target:
        env.DESK_API_PROXY_TARGET ||
        (https ? "https://connect.localhost:3000" : "http://localhost:3000"),
      changeOrigin: true,
      secure: false,
    },
  }

  return {
    // Served by the API under /app, ahead of apps/web: appBasePath in src/app/config.ts is the same.
    base: "/app/",
    plugins: [
      // Before the React plugin, as TanStack Router requires.
      tanstackRouter({
        target: "react",
        autoCodeSplitting: true,
        // A route's tests sit next to it, and are not routes.
        routeFileIgnorePattern: "\\.spec\\.tsx?$",
      }),
      react({
        babel: {
          // Lingui's macros compile before the React Compiler sees the components.
          plugins: [
            "@lingui/babel-plugin-lingui-macro",
            [
              "babel-plugin-react-compiler",
              {
                // A component the compiler gives up on stays unmemoized without a word, and most
                // often breaks a rule of React: the dev server, Storybook and the tests fail on it.
                // The production build keeps the default and ships it unmemoized.
                panicThreshold: command === "serve" ? "all_errors" : "none",
              },
            ],
          ],
        },
      }),
      lingui(),
      tailwindcss(),
    ],
    resolve: {
      alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
    },
    server: {
      port: 5177,
      strictPort: true,
      https,
      allowedHosts: ["connect.localhost"],
      proxy,
    },
    preview: {
      port: 5178,
      strictPort: true,
      https,
      allowedHosts: ["connect.localhost"],
      proxy,
    },
    test: {
      // The sign-in configuration the Desk requires; the tests never reach the provider.
      env: {
        VITE_OIDC_AUTHORITY: "https://idp.example.org",
        VITE_OIDC_CLIENT_ID: "desk-tests",
      },
      projects: [
        {
          extends: true,
          test: {
            name: "node",
            environment: "node",
            include: ["src/**/*.spec.ts"],
          },
        },
        {
          extends: true,
          test: {
            name: "dom",
            environment: "happy-dom",
            include: ["src/**/*.spec.tsx"],
            setupFiles: ["src/test/setup.ts"],
          },
        },
      ],
    },
  }
})
