import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { renderWithI18n } from "@/test/render-with-i18n"
import { ResultJson } from "./ResultJson"

const longJson = `${JSON.stringify(
  Object.fromEntries(Array.from({ length: 40 }, (_, index) => [`field${index}`, index])),
  null,
  2,
)}\n`

describe("ResultJson", () => {
  it("shortens a long result until the person asks for the rest", async () => {
    renderWithI18n(<ResultJson json={longJson} fileName="report.json" />)

    const showMore = screen.getByRole("button", { name: "Show more" })
    expect(showMore).toHaveAttribute("aria-expanded", "false")
    await userEvent.click(showMore)

    const showLess = screen.getByRole("button", { name: "Show less" })
    expect(showLess).toHaveAttribute("aria-expanded", "true")
    expect(document.getElementById(showLess.getAttribute("aria-controls") ?? "")).toHaveTextContent(
      '"field39": 39',
    )
  })

  it("shows a short result whole, with nothing to expand", () => {
    renderWithI18n(<ResultJson json={'{\n  "title": "Summary"\n}\n'} fileName="report.json" />)

    expect(screen.getByText("report.json")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Show more" })).not.toBeInTheDocument()
  })
})
