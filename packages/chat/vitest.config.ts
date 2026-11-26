import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    // The annotations and the quoted passages read a reply in a document.
    environment: "happy-dom",
    include: ["src/**/*.spec.ts"],
  },
})
