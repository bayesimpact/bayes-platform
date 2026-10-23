import { describe, expect, it } from "vitest"
import {
  annotationLine,
  citedPassagesOf,
  composeMessage,
  messageSegmentsOf,
  saveAnnotation,
} from "./annotation"

describe("annotationLine", () => {
  it("quotes the passage on one line, then the note", () => {
    expect(annotationLine("the Pro\n plan", "  is it per seat? ")).toBe(
      "<quote>the Pro plan</quote> is it per seat?",
    )
  })

  it("keeps the passage alone without a note, with its backticks, and no tag in it closes it", () => {
    expect(annotationLine("use `webhooks`", "")).toBe("<quote>use `webhooks`</quote>")
    expect(annotationLine("a </quote> tag", "")).toBe("<quote>a </ quote> tag</quote>")
  })

  it("names the reply the passage comes from, and which of its occurrences there it is", () => {
    const replyId = crypto.randomUUID()
    expect(annotationLine("the plan", "which one?", { replyId, occurrence: 2 })).toBe(
      `<quote reply="${replyId}" occurrence="2">the plan</quote> which one?`,
    )
  })
})

describe("saveAnnotation", () => {
  const first = { id: crypto.randomUUID(), note: "is it per seat?" }
  const second = { id: crypto.randomUUID(), note: "and for teams?" }

  it("adds a new annotation last, and puts an edited one in its place", () => {
    const saved = saveAnnotation([first], second)
    expect(saved).toEqual([first, second])
    expect(saveAnnotation(saved, { ...first, note: "per seat?" })).toEqual([
      { ...first, note: "per seat?" },
      second,
    ])
  })

  it("removes an annotation whose note was emptied, and never adds one without a note", () => {
    expect(saveAnnotation([first, second], { ...first, note: "  " })).toEqual([second])
    expect(saveAnnotation([first], { id: crypto.randomUUID(), note: "" })).toEqual([first])
  })
})

describe("composeMessage", () => {
  it("puts each annotation on a line of its own after what is written", () => {
    const annotations = [
      { passage: "Pro plan", note: "is it per seat?" },
      { passage: "webhooks", note: "which events?" },
    ]
    expect(composeMessage("First thought  \n", annotations)).toBe(
      "First thought\n<quote>Pro plan</quote> is it per seat?\n<quote>webhooks</quote> which events?",
    )
    expect(composeMessage("", annotations.slice(0, 1))).toBe(
      "<quote>Pro plan</quote> is it per seat?",
    )
  })
})

describe("messageSegmentsOf", () => {
  it("cuts a message into its text and its code between backticks", () => {
    expect(
      messageSegmentsOf("Compare these:\n`[Company Name]` Toto Inc.\n`Your Title` CEO"),
    ).toEqual([
      { kind: "text", text: "Compare these:\n" },
      { kind: "code", text: "[Company Name]" },
      { kind: "text", text: " Toto Inc.\n" },
      { kind: "code", text: "Your Title" },
      { kind: "text", text: " CEO" },
    ])
  })

  it("tells the passages quoted from a reply apart from the code between backticks", () => {
    const replyId = crypto.randomUUID()
    expect(
      messageSegmentsOf(
        `<quote>Pro plan</quote> and \`npm run dev\`?\n<quote reply="${replyId}" occurrence="3">plan</quote>`,
      ),
    ).toEqual([
      { kind: "quote", text: "Pro plan", source: null },
      { kind: "text", text: " and " },
      { kind: "code", text: "npm run dev" },
      { kind: "text", text: "?\n" },
      { kind: "quote", text: "plan", source: { replyId, occurrence: 3 } },
    ])
  })

  it("leaves a backtick left open, an empty pair and a passage across lines as text", () => {
    for (const content of ["an open ` backtick", "an empty `` pair", "a `passage\nacross` lines"]) {
      expect(messageSegmentsOf(content)).toEqual([{ kind: "text", text: content }])
    }
  })
})

describe("citedPassagesOf", () => {
  const greeting = { id: crypto.randomUUID(), role: "assistant", content: "Hello!" }
  const reply = { id: crypto.randomUUID(), role: "assistant", content: "Two plans." }

  it("finds the passages a message quotes, in the replies before it, the nearest first", () => {
    const message = {
      id: crypto.randomUUID(),
      role: "user",
      content: "Thanks:\n<quote>Two plans</quote> which ones?\n<quote>plans</quote> and the price?",
    }
    expect(citedPassagesOf([greeting, reply, message])).toEqual([
      expect.objectContaining({
        passage: "Two plans",
        position: 1,
        replyIds: [reply.id, greeting.id],
        occurrence: 1,
      }),
      expect.objectContaining({ passage: "plans", position: 3, replyIds: [reply.id, greeting.id] }),
    ])
  })

  it("looks only in the reply a passage names, at its occurrence, when that reply came before", () => {
    const quoting = (replyId: string) => ({
      id: crypto.randomUUID(),
      role: "user",
      content: `<quote reply="${replyId}" occurrence="2">plans</quote> which?`,
    })
    expect(citedPassagesOf([greeting, reply, quoting(greeting.id)])).toEqual([
      expect.objectContaining({ replyIds: [greeting.id], occurrence: 2 }),
    ])
    expect(citedPassagesOf([greeting, reply, quoting(crypto.randomUUID())])).toEqual([
      expect.objectContaining({ replyIds: [reply.id, greeting.id], occurrence: 1 }),
    ])
  })

  it("leaves out code between backticks, even at the start of a line, and a first message", () => {
    const first = {
      id: crypto.randomUUID(),
      role: "user",
      content: "<quote>Two plans</quote> first",
    }
    const written = { id: crypto.randomUUID(), role: "user", content: "`Two plans` right?" }
    expect(citedPassagesOf([first, reply, written])).toEqual([])
  })

  it("gives each passage a key of its message and its place", () => {
    const message = { id: crypto.randomUUID(), role: "user", content: "<quote>Two plans</quote>" }
    const [cited] = citedPassagesOf([reply, message])
    expect(cited?.key).not.toBe(
      citedPassagesOf([reply, { ...message, id: crypto.randomUUID() }])[0]?.key,
    )
  })
})
