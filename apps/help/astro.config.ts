import mdx from "@astrojs/mdx"
import sitemap from "@astrojs/sitemap"
import tailwindcss from "@tailwindcss/vite"
import type { AstroUserConfig } from "astro"
import { defineConfig } from "astro/config"

import { DEFAULT_LOCALE, LOCALES, SITE_URL } from "./src/consts"

// `@tailwindcss/vite` is typed against Vite 7 (hoisted for apps/web) while Astro
// bundles Vite 6. The plugin is runtime-compatible with both; this bridges the
// duplicated Vite type definitions so the config type-checks against Astro's Vite.
type VitePlugins = NonNullable<NonNullable<AstroUserConfig["vite"]>["plugins"]>
const vitePlugins = [tailwindcss()] as unknown as VitePlugins

// https://astro.build/config
export default defineConfig({
  site: SITE_URL,
  // Overridable so we can build several themed variants side by side (e.g. a coral
  // and a blue preview). Defaults to the standard `dist`.
  outDir: process.env.OUT_DIR ?? "dist",
  output: "static",
  trailingSlash: "ignore",
  i18n: {
    defaultLocale: DEFAULT_LOCALE,
    locales: [...LOCALES],
    routing: {
      // We handle the default-locale prefix ourselves via `/[lang]/...` routes,
      // so keep Astro from injecting its own redirect logic.
      prefixDefaultLocale: true,
      redirectToDefaultLocale: false,
    },
  },
  integrations: [mdx(), sitemap()],
  vite: {
    plugins: vitePlugins,
  },
})
