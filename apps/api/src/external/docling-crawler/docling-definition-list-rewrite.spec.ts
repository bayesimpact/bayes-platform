import { JSDOM } from "jsdom"
import { rewriteDefinitionListsAsUnorderedLists } from "./docling-definition-list-rewrite"

function rewrite(html: string): string {
  const dom = new JSDOM(`<body>${html}</body>`)
  ;(globalThis as { document?: Document }).document = dom.window.document

  rewriteDefinitionListsAsUnorderedLists()

  return dom.window.document.body.innerHTML
}

describe("rewriteDefinitionListsAsUnorderedLists", () => {
  it("rewrites plain-text dt/dd pairs into a ul of li elements", () => {
    const result = rewrite("<dl><dt>Term</dt><dd>Definition</dd></dl>")

    expect(result).toBe("<ul><li><strong>Term</strong> — Definition</li></ul>")
  })

  it("preserves nested markup inside dd instead of flattening it to text", () => {
    const result = rewrite(
      '<dl><dt>Term</dt><dd>See <a href="https://example.com">this link</a></dd></dl>',
    )

    expect(result).toBe(
      '<ul><li><strong>Term</strong> — See <a href="https://example.com">this link</a></li></ul>',
    )
  })

  it("omits the separator when a dt has no matching dd", () => {
    const result = rewrite("<dl><dt>Term</dt></dl>")

    expect(result).toBe("<ul><li><strong>Term</strong></li></ul>")
  })

  it("converts multiple dt/dd pairs within one dl, in order", () => {
    const result = rewrite("<dl><dt>First</dt><dd>One</dd><dt>Second</dt><dd>Two</dd></dl>")

    expect(result).toBe(
      "<ul><li><strong>First</strong> — One</li><li><strong>Second</strong> — Two</li></ul>",
    )
  })

  it("does nothing when the page has no dl elements", () => {
    const result = rewrite("<p>No definition lists here.</p>")

    expect(result).toBe("<p>No definition lists here.</p>")
  })
})
