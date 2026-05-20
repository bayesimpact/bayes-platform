import path from "node:path"
import { defineConfig } from "vite"

// Launcher script build — the tiny IIFE dropped on host pages via <script> tag.
// It injects the floating button and the iframe pointing back to this app.
export default defineConfig({
  build: {
    lib: {
      entry: path.resolve(__dirname, "src/launcher/index.ts"),
      name: "AgentStudioEmbed",
      fileName: "launcher",
      formats: ["iife"],
    },
    outDir: "dist-launcher",
    emptyOutDir: true,
  },
})
