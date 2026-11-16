import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    // The sandbox talks to frames and to `window`, which the tests' DOM stands in for.
    environment: "happy-dom",
    include: ["src/**/*.spec.ts"],
  },
})
