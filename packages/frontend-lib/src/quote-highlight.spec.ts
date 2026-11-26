import { describe, expect, it } from "vitest"
import { findPassage, indexPassages, occurrenceAt } from "./quote-highlight"

/** A reply as Markdown renders it, inside an element of its own. */
function replyOf(html: string): HTMLElement {
  const reply = document.createElement("div")
  reply.innerHTML = html
  return reply
}

describe("findPassage", () => {
  it("finds a passage across bold text, inline code and the items of a list", () => {
    const reply = replyOf(
      "<p>Here are the <strong>two plans</strong>, with <code>webhooks</code>:</p><ul><li>shared workspaces,</li><li>the integrations.</li></ul>",
    )
    const index = indexPassages(reply)
    expect(findPassage(index, "the two plans, with webhooks")?.toString()).toBe(
      "the two plans, with webhooks",
    )
    expect(findPassage(index, "shared workspaces, the integrations")?.toString()).toBe(
      "shared workspaces,the integrations",
    )
  })

  it("finds nothing that is not there, as it stands", () => {
    const index = indexPassages(replyOf("<p>Use the Team plan.</p>"))
    expect(findPassage(index, "use the Team")).toBeNull()
    expect(findPassage(index, "  ")).toBeNull()
  })
})

describe("occurrenceAt and findPassage", () => {
  it("count which occurrence of a passage a selection holds, and find that one again", () => {
    const reply = replyOf("<p>First, the plan.</p><p>Then the plan again.</p>")
    const second = reply.querySelectorAll("p")[1]?.firstChild
    if (!second) throw new Error("The reply has no second paragraph")
    const selection = document.createRange()
    selection.setStart(second, 5)
    selection.setEnd(second, 13)

    const index = indexPassages(reply)
    expect(occurrenceAt(index, "the plan", selection)).toBe(2)
    expect(findPassage(index, "the plan", 2)?.startContainer).toBe(second)
    expect(findPassage(index, "the plan", 3)).toBeNull()
  })

  it("tell a word apart from a longer one that holds it and comes first", () => {
    const reply = replyOf("<p>Nothing changed yet, but the change comes soon.</p>")
    const text = reply.querySelector("p")?.firstChild
    if (!(text instanceof Text)) throw new Error("The reply has no text")
    const selection = document.createRange()
    const start = text.data.indexOf("change comes")
    selection.setStart(text, start)
    selection.setEnd(text, start + "change".length)

    const index = indexPassages(reply)
    const occurrence = occurrenceAt(index, "change", selection)
    expect(occurrence).toBe(2)
    expect(findPassage(index, "change", occurrence)?.startOffset).toBe(start)
  })
})
