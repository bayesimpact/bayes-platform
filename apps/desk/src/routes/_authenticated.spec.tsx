import { screen } from "@testing-library/react"
import { HttpResponse, http } from "msw"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { buildDeskWorld } from "@/test/factories/desk-world.factory"
import { worldHandlers } from "@/test/msw/handlers"
import { server } from "@/test/msw/server"
import { renderApp } from "@/test/render-app"

const signIn = vi.hoisted(() => vi.fn())

vi.mock("@/lib/auth/session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/session")>()),
  hasSession: async () => true,
  getAccessToken: async () => "test-token",
  endSession: async () => undefined,
  signIn,
}))

beforeEach(() => {
  window.localStorage.clear()
  window.sessionStorage.clear()
  signIn.mockClear()
})

const refuseMe = (message: string) =>
  http.get("*/api/me", () =>
    HttpResponse.json({ statusCode: 401, message, error: "Unauthorized" }, { status: 401 }),
  )

describe("a sign-in the API refuses", () => {
  it("is explained, and sends the person nowhere on its own", async () => {
    server.use(
      ...worldHandlers(buildDeskWorld()),
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
    window.sessionStorage.setItem("desk.automaticSignInAt", String(Date.now()))
    server.use(...worldHandlers(buildDeskWorld()), refuseMe("Unauthorized"))
    renderApp("/app/")

    expect(await screen.findByText("The sign-in keeps failing")).toBeInTheDocument()
    expect(signIn).not.toHaveBeenCalled()
  })

  it("starts a new sign-in once, when none started lately", async () => {
    server.use(...worldHandlers(buildDeskWorld()), refuseMe("Unauthorized"))
    renderApp("/app/")

    await vi.waitFor(() => expect(signIn).toHaveBeenCalledTimes(1))
  })
})
