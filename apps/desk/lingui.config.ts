import { defineConfig } from "@lingui/cli"
import { formatter } from "@lingui/format-po"

// English is the source: the text in the components. `lingui extract` writes every message to the
// French catalog, whose translations the change that adds a text writes too. No fallback locale, so
// `lingui check missing` fails on a French translation left empty.
export default defineConfig({
  sourceLocale: "en",
  // The catalogs name each message's file without its line, so code that only moves changes them
  // not, and needs no extraction.
  format: formatter({ lineNumbers: false }),
  locales: ["en", "fr"],
  catalogs: [
    {
      path: "<rootDir>/src/locales/{locale}",
      include: ["src"],
    },
  ],
})
