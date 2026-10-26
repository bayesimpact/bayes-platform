import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
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

  it("shows a task list as checkboxes named by their item, without bullets, read only", async () => {
    renderWithI18n(<Markdown>{"- [x] Freeze the scope\n- [ ] Set the `price`"}</Markdown>)

    const done = await screen.findByRole("checkbox", { name: "Freeze the scope" })
    const open = screen.getByRole("checkbox", { name: "Set the price" })
    expect(done).toBeChecked()
    expect(open).not.toBeChecked()
    expect(done.closest("li")).toHaveClass("list-none")
    await userEvent.click(open)
    expect(open).not.toBeChecked()
  })

  it("names the task the person ticks by its place and its text, and shows the states given", async () => {
    const onTaskToggle = vi.fn()
    renderWithI18n(
      <Markdown taskStates={new Map([[1, false]])} onTaskToggle={onTaskToggle}>
        {"- [x] Freeze the scope\n- [ ] Set the `price`"}
      </Markdown>,
    )

    expect(await screen.findByRole("checkbox", { name: "Freeze the scope" })).not.toBeChecked()
    await userEvent.click(screen.getByRole("checkbox", { name: "Set the price" }))
    expect(onTaskToggle).toHaveBeenCalledWith({ item: 2, isChecked: true, text: "Set the price" })
  })
})
