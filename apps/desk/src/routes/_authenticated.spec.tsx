import { DeskAccountRoutes } from "@caseai-connect/desk-contracts"
import { screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { claimAutomaticSignIn } from "@/lib/auth/session"
import { apiError, mockRoute } from "@/test/msw/mock-route"
import { server } from "@/test/msw/server"
import { renderApp } from "@/test/render-app"

const signIn = vi.hoisted(() => vi.fn())
const hasSession = vi.hoisted(() => vi.fn(async () => true))

// The sign-in is watched here: this mock wins over the one of setup.ts.
vi.mock("@/lib/auth/session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/session")>()),
  hasSession,
  getAccessToken: async () => "test-token",
  endSession: async () => undefined,
  signIn,
}))

beforeEach(() => {
  signIn.mockClear()
  hasSession.mockResolvedValue(true)
})

const refuseMe = (message: string) =>
  mockRoute(DeskAccountRoutes.getMe, () => apiError(401, message))

describe("a sign-in the API refuses", () => {
  it("is explained, and sends the person nowhere on its own", async () => {
    server.use(
      refuseMe(
        "An account already exists for this email, but the identity provider does not report the email as verified",
      ),
    )
    renderApp("/app/")

    expect(await screen.findByText("Verify your email")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument()
    expect(signIn).not.toHaveBeenCalled()
  })
})

describe("a session that ends again right after a new sign-in", () => {
  it("stops the sign-ins and says so, rather than loop", async () => {
    // A new sign-in started a moment ago, and the API still refuses the token it brought.
    expect(claimAutomaticSignIn()).toBe(true)
    server.use(refuseMe("Unauthorized"))
    renderApp("/app/")

    expect(await screen.findByText("The sign-in keeps failing")).toBeInTheDocument()
    expect(signIn).not.toHaveBeenCalled()
  })

  it("starts a new sign-in once, when none started lately", async () => {
    server.use(refuseMe("Unauthorized"))
    renderApp("/app/")

    await vi.waitFor(() => expect(signIn).toHaveBeenCalledTimes(1))
  })
})

describe("a session the browser does not keep", () => {
  it("starts a sign-in when none started lately", async () => {
    hasSession.mockResolvedValue(false)
    renderApp("/app/")

    await vi.waitFor(() => expect(signIn).toHaveBeenCalledTimes(1))
  })

  it("stops after a sign-in a moment ago, and says so, rather than loop", async () => {
    // A sign-in completed a moment ago, but the browser kept no session from it.
    expect(claimAutomaticSignIn()).toBe(true)
    hasSession.mockResolvedValue(false)
    renderApp("/app/")

    expect(await screen.findByText("The sign-in keeps failing")).toBeInTheDocument()
    expect(signIn).not.toHaveBeenCalled()
  })
})
