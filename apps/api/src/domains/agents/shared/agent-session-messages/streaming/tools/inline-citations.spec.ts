import { createInlineCitationExtractor, stripInlineCitations } from "./inline-citations"

describe("stripInlineCitations", () => {
  it("removes the markers and the blank before them, and records the aliases", () => {
    const { text, citedAliases } = stripInlineCitations(
      "You get 27 days of paid leave [c1]. Part-time staff accrue pro rata [c1, c3].\nSee HR [c12].",
    )
    expect(text).toBe("You get 27 days of paid leave. Part-time staff accrue pro rata.\nSee HR.")
    expect(citedAliases).toEqual(["c1", "c3", "c12"])
  })

  it("tolerates spaces, semicolons and upper case inside the marker", () => {
    const { text, citedAliases } = stripInlineCitations("Yes [ C2 ; c4 ] indeed [c4][C5].")
    expect(text).toBe("Yes indeed.")
    expect(citedAliases).toEqual(["c2", "c4", "c5"])
  })

  it("leaves ordinary brackets alone", () => {
    const { text, citedAliases } = stripInlineCitations(
      "See [the portal] or array[0]; the code [c] and [1] stay, as does [cx1].",
    )
    expect(text).toBe("See [the portal] or array[0]; the code [c] and [1] stay, as does [cx1].")
    expect(citedAliases).toEqual([])
  })

  it("keeps a line break before a marker that starts a line", () => {
    const { text } = stripInlineCitations("First point.\n[c1] Second point.")
    expect(text).toBe("First point.\nSecond point.")
  })
})

describe("createInlineCitationExtractor (streaming)", () => {
  const collect = (chunks: string[]) => {
    const extractor = createInlineCitationExtractor()
    const emitted = chunks.map((chunk) => extractor.feed(chunk))
    emitted.push(extractor.flush())
    return { text: emitted.join(""), emitted, citedAliases: extractor.citedAliases() }
  }

  it("strips a marker split across deltas", () => {
    const { text, citedAliases } = collect(["27 days [", "c1", "]. Enjoy", "!"])
    expect(text).toBe("27 days. Enjoy!")
    expect(citedAliases).toEqual(["c1"])
  })

  it("holds back the blank before a marker so it is stripped with it", () => {
    const { text } = collect(["27 days", " ", "[c1].", " Enjoy!"])
    expect(text).toBe("27 days. Enjoy!")
  })

  it("emits text eagerly when no marker is open", () => {
    const { emitted } = collect(["Hello", " world", "."])
    expect(emitted.slice(0, 3)).toEqual(["Hello", " world", "."])
  })

  it("releases an unclosed bracket once it is clearly prose", () => {
    const longTail = "[this is a long parenthetical remark that never closes and keeps going on"
    const { text } = collect(["Start ", longTail, " end"])
    expect(text).toBe(`Start ${longTail} end`)
  })

  it("releases an unclosed bracket at flush", () => {
    const { text, citedAliases } = collect(["Open [c1", ""])
    expect(text).toBe("Open [c1")
    expect(citedAliases).toEqual([])
  })
})
