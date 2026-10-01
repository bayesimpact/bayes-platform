import path from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// Runs the real app (store, router, middleware, components) with the identity provider and the API
// replaced by local stubs. See .claude/skills/web-harness/SKILL.md.
const web = path.resolve(__dirname, "..")

export default defineConfig({
  root: __dirname,
  publicDir: path.resolve(web, "public"),
  plugins: [react({ babel: { plugins: [["babel-plugin-react-compiler"]] } }), tailwindcss()],
  resolve: {
    alias: [
      { find: /^react-oidc-context$/, replacement: path.resolve(__dirname, "auth-stub.tsx") },
      {
        find: /^@\/external\/oidcClient$/,
        replacement: path.resolve(__dirname, "oidc-client-stub.ts"),
      },
      {
        find: /^@\/external\/axios\.services$/,
        replacement: path.resolve(__dirname, "mock-services.ts"),
      },
      { find: /^@\//, replacement: `${web}/src/` },
      {
        find: "@caseai-connect/api-contracts",
        replacement: path.resolve(web, "../../packages/api-contracts/src/index.ts"),
      },
    ],
  },
  build: { outDir: path.resolve(__dirname, "dist"), emptyOutDir: true },
  server: { port: 5198, strictPort: true },
  preview: { port: 5199, strictPort: true },
})
