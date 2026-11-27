import type { Messages } from "@lingui/core"

export const LOCALES = ["en", "fr", "de", "it", "es", "pl"] as const
export type Locale = (typeof LOCALES)[number]

// Vite refuses a variable import of the folder it sits in (`import(`./${locale}.po`)`) and leaves
// it as it is in the build, so the catalogs are listed with a glob, which the bundler splits into
// one chunk per language.
const catalogs = import.meta.glob<{ messages: Messages }>("./*.po")

/** The texts this package shows, in a language: an app loads them next to its own catalog. */
export async function loadMessages(locale: Locale): Promise<Messages> {
  const load = catalogs[`./${locale}.po`]
  if (!load) throw new Error(`No catalog of the shared texts in ${locale}`)
  const { messages } = await load()
  return messages
}
