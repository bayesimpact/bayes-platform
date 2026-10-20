import { defineConfig } from "@lingui/cli"

// English is the source: the text in the components. `lingui extract` writes every message to the
// French catalog, whose translations the change that adds a text writes too. No fallback locale, so
// `lingui check missing` fails on a French translation left empty.
export default defineConfig({
  sourceLocale: "en",
  locales: ["en", "fr"],
  catalogs: [
    {
      path: "<rootDir>/src/locales/{locale}",
      include: ["src"],
    },
  ],
})
