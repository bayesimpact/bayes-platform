import { defineConfig } from "@lingui/cli"
import { formatter } from "@lingui/format-po"

// English is the source: the text in the components. `lingui extract` writes every message to the
// catalog of each other language, whose translations the change that adds a text writes too. No
// fallback locale, so `lingui check missing` fails on a translation left empty in any of them.
export default defineConfig({
  sourceLocale: "en",
  // The catalogs name each message's file without its line, so code that only moves changes them
  // not, and needs no extraction.
  format: formatter({ lineNumbers: false }),
  locales: ["en", "fr", "de", "it", "es", "pl"],
  catalogs: [
    {
      path: "<rootDir>/src/locales/{locale}",
      include: ["src"],
    },
    // The texts of packages/app-ui: the app loads this catalog next to its own (`loadMessages`).
    {
      path: "<rootDir>/../../packages/app-ui/src/locales/{locale}",
      include: ["<rootDir>/../../packages/app-ui/src"],
    },
  ],
})
