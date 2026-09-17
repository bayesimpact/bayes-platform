import {
  createRepeatedStepTextFilter,
  type StreamPartLike,
} from "@/external/llm/repeated-step-text-filter"

function run(parts: StreamPartLike[]): { emitted: string[]; dropped: string[] } {
  const filter = createRepeatedStepTextFilter()
  const emitted: string[] = []
  for (const part of parts) {
    const text = filter.feed(part)
    if (text.length > 0) emitted.push(text)
  }
  const tail = filter.flush()
  if (tail.length > 0) emitted.push(tail)
  return { emitted, dropped: filter.dropped() }
}

const step = (...texts: string[]): StreamPartLike[] => [
  { type: "start-step" },
  ...texts.map((text) => ({ type: "text-delta" as const, text })),
  { type: "tool-call" },
  { type: "finish-step" },
]

describe("createRepeatedStepTextFilter", () => {
  it("streams a single step as is", () => {
    expect(run(step("Hel", "lo", " there"))).toEqual({
      emitted: ["Hel", "lo", " there"],
      dropped: [],
    })
  })

  it("drops the text a step repeats word for word after a tool result", () => {
    const { emitted, dropped } = run([
      ...step("Thanks, ", "all done."),
      ...step("Thanks, all", " done."),
    ])
    expect(emitted).toEqual(["Thanks, ", "all done."])
    expect(dropped).toEqual(["Thanks, all done."])
  })

  it("drops a truncated repeat too", () => {
    const { emitted, dropped } = run([...step("Thanks, all done."), ...step("Thanks, all")])
    expect(emitted).toEqual(["Thanks, all done."])
    expect(dropped).toEqual(["Thanks, all"])
  })

  it("releases a step that starts like the previous one and then says something new", () => {
    const { emitted, dropped } = run([
      ...step("Thanks."),
      ...step("Thanks", ". Your file is ", "complete."),
    ])
    expect(emitted).toEqual(["Thanks.", "Thanks. Your file is ", "complete."])
    expect(dropped).toEqual([])
  })

  it("streams a different follow-up without holding it back", () => {
    const { emitted } = run([...step("One moment."), ...step("Here ", "is the result.")])
    expect(emitted).toEqual(["One moment.", "Here ", "is the result."])
  })

  it("compares with the last step that carried text, skipping tool-only steps", () => {
    const { emitted, dropped } = run([...step("All set."), ...step(), ...step("All set.")])
    expect(emitted).toEqual(["All set."])
    expect(dropped).toEqual(["All set."])
  })

  it("keeps a repeat inside a single step, only step boundaries count", () => {
    const { emitted } = run(step("Yes. ", "Yes. "))
    expect(emitted).toEqual(["Yes. ", "Yes. "])
  })

  it("flushes held text when the stream ends without a finish-step", () => {
    const filter = createRepeatedStepTextFilter()
    for (const part of step("Done.")) filter.feed(part)
    filter.feed({ type: "start-step" })
    expect(filter.feed({ type: "text-delta", text: "Done." })).toBe("")
    expect(filter.flush()).toBe("")
    expect(filter.dropped()).toEqual(["Done."])
  })
})
