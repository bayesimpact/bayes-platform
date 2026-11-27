import react from "@vitejs/plugin-react"
import { defineConfig } from "vitest/config"

export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [
          // A component the compiler gives up on stays unmemoized without a word, and most often
          // breaks a rule of React: the specs fail on it.
          ["babel-plugin-react-compiler", { panicThreshold: "all_errors" }],
        ],
      },
    }),
  ],
  test: {
    // The annotations and the quoted passages read a reply in a document.
    environment: "happy-dom",
    include: ["src/**/*.spec.ts", "src/**/*.spec.tsx"],
    setupFiles: ["src/test/setup.ts"],
  },
})
