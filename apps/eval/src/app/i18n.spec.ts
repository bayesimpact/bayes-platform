import { loadMessages, LOCALES as SHARED_LOCALES } from "@caseai-connect/app-ui/locales"
import { hasOwnKey } from "@caseai-connect/frontend-lib"
import { describe, expect, it } from "vitest"
import { LOCALES, SPEECH_LANGUAGES } from "./i18n"

describe("the app's languages", () => {
  it("are those that have a catalog, which `lingui extract` writes from lingui.config.ts", () => {
    const catalogs = Object.keys(import.meta.glob("../locales/*.po")).map((path) =>
      path.replace(/^.*\/([^/]+)\.po$/, "$1"),
    )

    expect(catalogs.sort()).toEqual([...LOCALES].sort())
  })

  it("each have a speech language of their own, which starts with their code", () => {
    for (const locale of LOCALES)
      expect(SPEECH_LANGUAGES[locale]).toMatch(new RegExp(`^${locale}-`))
  })

  it("has every one of its languages in the catalog of each shared package", () => {
    expect([...SHARED_LOCALES].sort()).toEqual(expect.arrayContaining([...LOCALES].sort()))
  })

  it("gives one translation to a message that two of its catalogs hold", async () => {
    for (const locale of LOCALES) {
      const shared = await loadMessages(locale)
      const { messages } = await import(`../locales/${locale}.po`)
      for (const id of Object.keys(messages).filter((key) => hasOwnKey(shared, key)))
        expect(messages[id], `${locale}: ${id}`).toEqual(shared[id])
    }
  })
})
