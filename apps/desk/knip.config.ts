import type { KnipConfig } from "knip"

const config: KnipConfig = {
  entry: ["lingui.config.ts"],
  project: ["src/**/*.{ts,tsx,css}", "*.config.ts"],
  // Biome and TypeScript are the repository's, at its root.
  ignoreBinaries: ["biome", "tsc"],
  // The components shadcn's CLI generates export every part of a component, used or not.
  ignoreIssues: {
    "src/components/ui/**": ["exports", "types"],
  },
  // Packages a stylesheet imports count as used: knip reads the CSS `@import`s.
  compilers: {
    css: (text: string) => [...text.matchAll(/(?<=@)import[^;]+/g)].join("\n"),
  },
}

export default config
