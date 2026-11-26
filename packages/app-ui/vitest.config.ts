import react from "@vitejs/plugin-react"
import { defineConfig } from "vitest/config"

export default defineConfig({
  // Lingui's macros compile in the specs as they do in the apps. The package's
  // `lingui.config.ts` only names the languages, for the macro: the apps extract the catalog.
  plugins: [react({ babel: { plugins: ["@lingui/babel-plugin-lingui-macro"] } })],
  test: {
    environment: "happy-dom",
    include: ["src/**/*.spec.ts", "src/**/*.spec.tsx"],
    setupFiles: ["src/test/setup.ts"],
  },
})
