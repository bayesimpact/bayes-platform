import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    // The specs stub the few browser globals the client reads: `window`, `navigator`, `fetch`.
    environment: "node",
    include: ["src/**/*.spec.ts"],
  },
})
