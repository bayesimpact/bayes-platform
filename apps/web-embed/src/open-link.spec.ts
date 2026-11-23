// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest"
import { OPEN_LINK_MESSAGE, readLinkTarget, sendLinksToParent } from "./open-link"

describe("readLinkTarget", () => {
  it("defaults to opening links from the iframe", () => {
    expect(readLinkTarget("")).toBe("blank")
    expect(readLinkTarget("?linkTarget=other")).toBe("blank")
  })

  it("sends links to the host page when asked", () => {
    expect(readLinkTarget("?embedToken=abc&linkTarget=parent")).toBe("parent")
  })
})

describe("sendLinksToParent", () => {
  let cleanup: (() => void) | undefined

  afterEach(() => {
    cleanup?.()
    document.body.innerHTML = ""
    vi.restoreAllMocks()
  })

  function setUp(html: string) {
    document.body.innerHTML = html
    const postMessage = vi.spyOn(window.parent, "postMessage").mockImplementation(() => {})
    cleanup = sendLinksToParent(window)
    return postMessage
  }

  it("sends the address of a clicked link, card content included, and cancels the click", () => {
    const postMessage = setUp(
      `<a href="https://example.org/fiche" target="_blank"><span id="inner">Fiche</span></a>`,
    )
    const event = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 })
    document.getElementById("inner")?.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(true)
    expect(postMessage).toHaveBeenCalledWith(
      { type: OPEN_LINK_MESSAGE, url: "https://example.org/fiche" },
      "*",
    )
  })

  it("leaves other clicks alone", () => {
    const postMessage = setUp(`<a href="mailto:a@b.c" id="mail">mail</a><button id="b">ok</button>`)
    for (const id of ["mail", "b"]) {
      const event = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 })
      document.getElementById(id)?.dispatchEvent(event)
      expect(event.defaultPrevented).toBe(false)
    }
    expect(postMessage).not.toHaveBeenCalled()
  })
})
