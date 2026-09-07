import { findLeakedToolCallNames, ThoughtTokensHelper } from "./thought-tokens-helper"

// A leak captured from gemini-3.5-flash-lite: the model verbalizes its tool
// call as pseudo-XML in the user-visible text instead of emitting a
// functionCall part.
const LEAKED_PSEUDO_CALL =
  '<call:default_api:mandatory_tool xmlns:default_api="default_api" categoryNames:[greetings,QA],suggestedTitle:Règles de Warmachine et pays de pays/>'

// A newer leak variant captured in production: opens with `<function:` and
// terminates at the closing brace of its arguments — there is no `>` at all.
const LEAKED_FUNCTION_CALL =
  "<function:default_api:mandatory_tool{categoryNames:[test],suggestedTitle:null}"

// Captured in production: no `<` at all, the namespace is glued to a garbled
// word and only the argument braces delimit the call.
const LEAKED_BARE_CALL = "Lie:default_api:mandatory_tool{categoryNames:[],suggestedTitle:null}"

describe("ThoughtTokensHelper - hallucinated tool-call XML", () => {
  it("removes a pseudo-call tag from a complete text", () => {
    const text = `C'est noté, tu habites en France !\n\n${LEAKED_PSEUDO_CALL}`
    const cleaned = ThoughtTokensHelper.removeThoughtTokens(text)

    expect(cleaned).not.toContain("default_api")
    expect(cleaned).not.toContain("<call:")
    expect(cleaned).toContain("C'est noté, tu habites en France !")
  })

  it("removes variants of the default_api family", () => {
    const cleaned = ThoughtTokensHelper.removeThoughtTokens(
      'a <default_api:mandatory_tool args="x"/> b </default_api:call> c',
    )
    expect(cleaned).toBe("a  b  c")
  })

  it("removes the brace-terminated <function:> variant that has no closing angle bracket", () => {
    const text = `Je vous invite à contacter votre conseiller.\n\n${LEAKED_FUNCTION_CALL}`
    const cleaned = ThoughtTokensHelper.removeThoughtTokens(text)

    expect(cleaned).not.toContain("default_api")
    expect(cleaned).not.toContain("<function")
    expect(cleaned).toContain("Je vous invite à contacter votre conseiller.")
  })

  it("removes the brace-terminated variant for the whole opener family", () => {
    const cleaned = ThoughtTokensHelper.removeThoughtTokens(
      "a <call:default_api:notify_operator{severity:high} b <default_api:mandatory_tool{x:1} c",
    )
    expect(cleaned).toBe("a  b  c")
  })

  it("removes the bare variant with no angle bracket and a garbled prefix", () => {
    const text = `Bonjour ! Comment puis-je vous aider aujourd'hui ? ${LEAKED_BARE_CALL}`
    const cleaned = ThoughtTokensHelper.removeThoughtTokens(text)

    expect(cleaned).not.toContain("default_api")
    expect(cleaned).not.toContain("Lie:")
    expect(cleaned).toBe("Bonjour ! Comment puis-je vous aider aujourd'hui ? ")
  })

  it("keeps legitimate text mentioning the function keyword", () => {
    const text = "En JS, une fonction s'écrit function foo() {} et on vérifie que 2 < 3."
    expect(ThoughtTokensHelper.removeThoughtTokens(text)).toBe(text)
  })

  it("keeps legitimate text with angle brackets and comparisons", () => {
    const text = "En maths, 2 < 3 et 5 > 4. Le tag <b>gras</b> reste, tout comme a < b."
    expect(ThoughtTokensHelper.removeThoughtTokens(text)).toBe(text)
  })

  it("strips the pseudo-call even when split across many stream deltas", () => {
    const stripper = ThoughtTokensHelper.createStripper()
    const full = `Voici ma réponse complète pour toi, avec assez de texte pour dépasser la retenue du stripper.\n\n${LEAKED_PSEUDO_CALL}`
    let out = ""
    // 7-char deltas: the tag is split mid-emission many times over.
    for (let i = 0; i < full.length; i += 7) {
      out += stripper.feed(full.slice(i, i + 7))
    }
    out += stripper.flush()

    expect(out).not.toContain("default_api")
    expect(out).not.toContain("<call:")
    expect(out).toContain("Voici ma réponse complète")
  })

  it("strips the brace-terminated <function:> variant even when split across stream deltas", () => {
    const stripper = ThoughtTokensHelper.createStripper()
    const full = `Voici ma réponse complète pour toi, avec assez de texte pour dépasser la retenue du stripper.\n\n${LEAKED_FUNCTION_CALL}`
    let out = ""
    for (let i = 0; i < full.length; i += 7) {
      out += stripper.feed(full.slice(i, i + 7))
    }
    out += stripper.flush()

    expect(out).not.toContain("default_api")
    expect(out).not.toContain("<function")
    expect(out).toContain("Voici ma réponse complète")
  })

  it("strips the bare variant even when split across stream deltas", () => {
    const stripper = ThoughtTokensHelper.createStripper()
    const full = `Voici ma réponse complète pour toi, avec assez de texte pour dépasser la retenue du stripper.\n\n${LEAKED_BARE_CALL}`
    let out = ""
    for (let i = 0; i < full.length; i += 7) {
      out += stripper.feed(full.slice(i, i + 7))
    }
    out += stripper.flush()

    expect(out).not.toContain("default_api")
    expect(out).not.toContain("Lie:")
    expect(out).toContain("Voici ma réponse complète")
  })

  it("does not stall the stream on a never-closed lookalike", () => {
    const stripper = ThoughtTokensHelper.createStripper()
    const full = `Début. <call:jamais fermé ${"x".repeat(700)} fin du texte.`
    let out = ""
    for (let i = 0; i < full.length; i += 20) {
      out += stripper.feed(full.slice(i, i + 20))
    }
    out += stripper.flush()

    // The giant lookalike is not a real tag (never closed): the stream must
    // still deliver the surrounding text once the hold-back cap is passed.
    expect(out).toContain("Début.")
    expect(out).toContain("fin du texte.")
  })
})

describe("findLeakedToolCallNames", () => {
  it("extracts the tool name from the brace-argument variant", () => {
    const text =
      "Voici votre réponse.\n\n<call:default_api:notify_operator{severity:high," +
      "summary:Escalation requested by the user.,reference:ABC-123}/>"

    expect(findLeakedToolCallNames(text)).toEqual(["notify_operator"])
  })

  it("extracts the tool name from the attribute-style variant", () => {
    expect(findLeakedToolCallNames(LEAKED_PSEUDO_CALL)).toEqual(["mandatory_tool"])
  })

  it("extracts the tool name from the <function:> brace variant with no closing angle bracket", () => {
    const text = `Je vous invite à contacter votre conseiller.\n\n${LEAKED_FUNCTION_CALL}`
    expect(findLeakedToolCallNames(text)).toEqual(["mandatory_tool"])
  })

  it("extracts the tool name from the bare variant with no angle bracket", () => {
    expect(findLeakedToolCallNames(`Bonjour ! ${LEAKED_BARE_CALL}`)).toEqual(["mandatory_tool"])
  })

  it("returns nothing for legitimate text, including angle brackets and markup", () => {
    expect(findLeakedToolCallNames("2 < 3 and <b>bold</b> and a call: to action")).toEqual([])
    expect(findLeakedToolCallNames("Voici ma réponse, sans balise.")).toEqual([])
  })

  it("deduplicates repeated leaks of the same tool", () => {
    const text = `${LEAKED_PSEUDO_CALL} then again ${LEAKED_PSEUDO_CALL}`
    expect(findLeakedToolCallNames(text)).toEqual(["mandatory_tool"])
  })
})
