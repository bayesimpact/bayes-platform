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

// The deploy job passes the tenant's help URL (canonical links, sitemap). `process.env`
// is the accessor available inside the config file.
const siteUrl = process.env.PUBLIC_SITE_URL || SITE_URL

// https://astro.build/config
export default defineConfig({
  site: siteUrl,
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
  // The site is light-only; Astro's default Shiki theme paints code blocks dark.
  markdown: {
    shikiConfig: { theme: "github-light" },
  },
  vite: {
    plugins: vitePlugins,
  },
})
