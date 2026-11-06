import { screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { renderApp } from "@/test/render-app"

const session = vi.hoisted(() => ({ completeSignIn: vi.fn(), signIn: vi.fn() }))

vi.mock("@/lib/auth/session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/session")>()),
  completeSignIn: session.completeSignIn,
  signIn: session.signIn,
}))

beforeEach(() => {
  window.sessionStorage.clear()
  session.signIn.mockReset().mockResolvedValue(undefined)
})

describe("the sign-in callback", () => {
  it("explains a refusal of the provider in its own words, from the URL's query", async () => {
    session.completeSignIn.mockRejectedValue(new Error("access_denied"))
    renderApp("/app/auth/callback?error=access_denied&error_description=The%20user%20cancelled")

    expect(await screen.findByText("Sign-in failed")).toBeInTheDocument()
    expect(screen.getByText("The user cancelled")).toBeInTheDocument()
    expect(session.signIn).not.toHaveBeenCalled()
  })

  it("starts a new sign-in on its own when this tab lost its state", async () => {
    session.completeSignIn.mockRejectedValue(new Error("No matching state found in storage"))
    renderApp("/app/auth/callback?code=abc&state=lost")

    expect(await screen.findByText("Sign-in expired")).toBeInTheDocument()
    expect(session.signIn).toHaveBeenCalledTimes(1)
  })
})
