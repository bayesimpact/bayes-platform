import { delay, HttpResponse, http } from "msw"
import { buildMe } from "../factories/account.factory"

/** `GET desk/me`, answered with the given person and projects. */
export const meHandler = (me = buildMe()) =>
  http.get("*/api/desk/me", () => HttpResponse.json({ data: me }))

/** The API as the mock mode and the tests start from. */
export const handlers = [meHandler()]

/**
 * Other states of the screens, for the mock mode: `/app/?mock=empty`, `?mock=error`, `?mock=loading`.
 */
export const mockScenarios = {
  empty: [meHandler(buildMe({ projects: [] }))],
  error: [http.get("*/api/desk/me", () => new HttpResponse(null, { status: 503 }))],
  loading: [
    http.get("*/api/desk/me", async () => {
      await delay("infinite")
      return HttpResponse.json({})
    }),
  ],
}
