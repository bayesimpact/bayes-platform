import { ExternalLink } from "@caseai-connect/app-ui/compositions/ExternalLink"
import { msg } from "@lingui/core/macro"
import { screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { renderWithI18n } from "@/test/render-with-i18n"
import { activateLocale, i18n } from "./i18n"

describe("the texts of a shared package", () => {
  it("show in the language the person picked", async () => {
    await activateLocale("fr")
    // The message of ExternalLink, in the catalog of packages/app-ui.
    expect(i18n._(msg`(opens in a new tab)`)).toBe("(s'ouvre dans un nouvel onglet)")
    await activateLocale("en")
  })

  it("show in the accessible name of a component of the package", async () => {
    await activateLocale("fr")
    try {
      renderWithI18n(<ExternalLink href="https://example.com">Aide</ExternalLink>)

      expect(screen.getByRole("link", { name: /s'ouvre dans un nouvel onglet/ })).toBeTruthy()
    } finally {
      await activateLocale("en")
    }
  })
})
