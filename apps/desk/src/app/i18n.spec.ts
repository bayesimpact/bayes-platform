import { describe, expect, it } from "vitest"
import { LOCALES, SPEECH_LANGUAGES } from "./i18n"

describe("the Desk's languages", () => {
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
})
