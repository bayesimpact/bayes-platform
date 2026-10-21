import { screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { renderWithI18n } from "@/test/render-with-i18n"
import { Markdown } from "./Markdown"

describe("Markdown", () => {
  it("never loads an image of the reply, which could send data to any server", async () => {
    const { container } = renderWithI18n(
      <Markdown>{"See ![the chart](https://example.org/chart.png?data=secret)"}</Markdown>,
    )

    const link = await screen.findByRole("link", { name: /the chart/ })
    expect(link).toHaveAttribute("href", "https://example.org/chart.png?data=secret")
    expect(container.querySelector("img")).toBeNull()
  })

  it("opens links in a new tab, without the opener", async () => {
    renderWithI18n(<Markdown>{"Read [the guide](https://example.org/guide)."}</Markdown>)

    const link = await screen.findByRole("link", { name: /the guide/ })
    expect(link).toHaveAttribute("target", "_blank")
    expect(link).toHaveAttribute("rel", "noopener noreferrer")
  })
})
