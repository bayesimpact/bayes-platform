import path from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// SPA build — served inside the iframe
export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [["babel-plugin-react-compiler"]],
      },
    }),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@caseai-connect/api-contracts": path.resolve(
        __dirname,
        "../../packages/api-contracts/src/index.ts",
      ),
    },
  },
  server: {
    port: 5175,
  },
  preview: {
    port: 5176,
  },
})
