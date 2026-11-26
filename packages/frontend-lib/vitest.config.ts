import { defineConfig } from "vitest/config"

export default defineConfig({
  // The specs that render a component use React's automatic JSX runtime, as the apps do.
  esbuild: { jsx: "automatic" },
  test: {
    // The hooks render, and the highlights build a reply, in a document.
    environment: "happy-dom",
    include: ["src/**/*.spec.ts", "src/**/*.spec.tsx"],
  },
})
