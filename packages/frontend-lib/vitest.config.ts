import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    // The specs of the highlights build a reply in a document.
    environment: "happy-dom",
    include: ["src/**/*.spec.ts"],
  },
})
