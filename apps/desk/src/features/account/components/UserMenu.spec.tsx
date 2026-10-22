import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { buildMe } from "@/test/factories/account.factory"
import { renderWithI18n } from "@/test/render-with-i18n"
import { UserMenu } from "./UserMenu"

const { user } = buildMe()

const renderMenu = () => {
  const handlers = { onLocaleChange: vi.fn(), onEditName: vi.fn(), onSignOut: vi.fn() }
  renderWithI18n(<UserMenu user={user} locale="en" locales={["en", "fr"]} {...handlers} />)
  return handlers
}

describe("UserMenu", () => {
  it("shows the person's name, and their email in the menu", async () => {
    renderMenu()

    await userEvent.click(
      screen.getByRole("button", { name: `${user.name}, menu of ${user.email}` }),
    )

    expect(await screen.findByText(user.email)).toBeInTheDocument()
  })

  it("switches the language", async () => {
    const { onLocaleChange } = renderMenu()

    await userEvent.click(
      screen.getByRole("button", { name: `${user.name}, menu of ${user.email}` }),
    )
    await userEvent.click(await screen.findByRole("menuitemradio", { name: "Français" }))

    expect(onLocaleChange).toHaveBeenCalledWith("fr")
  })

  it("signs out", async () => {
    const { onSignOut } = renderMenu()

    await userEvent.click(
      screen.getByRole("button", { name: `${user.name}, menu of ${user.email}` }),
    )
    await userEvent.click(await screen.findByRole("menuitem", { name: "Sign out" }))

    expect(onSignOut).toHaveBeenCalled()
  })
})
