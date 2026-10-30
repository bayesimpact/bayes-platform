import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { buildMe } from "@/test/factories/account.factory"
import { renderWithI18n } from "@/test/render-with-i18n"
import { UserMenu } from "./UserMenu"

const { user } = buildMe()

const renderMenu = ({ helpCenterUrl = null }: { helpCenterUrl?: string | null } = {}) => {
  const handlers = { onLocaleChange: vi.fn(), onEditName: vi.fn(), onSignOut: vi.fn() }
  renderWithI18n(
    <UserMenu
      user={user}
      locale="en"
      locales={["en", "fr"]}
      homeUrl="/onboarding"
      helpCenterUrl={helpCenterUrl}
      {...handlers}
    />,
  )
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

  it("goes back to the platform's home, in the same tab", async () => {
    renderMenu()

    await userEvent.click(
      screen.getByRole("button", { name: `${user.name}, menu of ${user.email}` }),
    )
    const link = await screen.findByRole("menuitem", { name: "Home" })

    expect(link).toHaveAttribute("href", "/onboarding")
    expect(link).not.toHaveAttribute("target")
  })

  it("links to the install's help center, in a new tab", async () => {
    renderMenu({ helpCenterUrl: "https://help.example.org/" })

    await userEvent.click(
      screen.getByRole("button", { name: `${user.name}, menu of ${user.email}` }),
    )
    const link = await screen.findByRole("menuitem", { name: /Help center/ })

    expect(link).toHaveAttribute("href", "https://help.example.org/")
    expect(link).toHaveAttribute("target", "_blank")
  })

  it("shows no help center when the install has none", async () => {
    renderMenu()

    await userEvent.click(
      screen.getByRole("button", { name: `${user.name}, menu of ${user.email}` }),
    )
    await screen.findByRole("menuitem", { name: "Sign out" })

    expect(screen.queryByRole("menuitem", { name: /Help center/ })).not.toBeInTheDocument()
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
