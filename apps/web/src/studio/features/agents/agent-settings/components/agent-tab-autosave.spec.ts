import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  AUTOSAVE_DELAY_MS,
  type AutosaveArgs,
  createAutosaver,
  type TabSaveState,
} from "./agent-tab-autosave"

type Values = { title: string; summary: string }

function setup({
  validate,
  save,
}: {
  validate?: (values: Values) => Values | null
  save?: (args: AutosaveArgs<Values>) => Promise<void>
} = {}) {
  const form = { values: { title: "Pricing", summary: "Plans and prices" } as Values }
  const states: TabSaveState[] = []
  const saves: AutosaveArgs<Values>[] = []
  const autosaver = createAutosaver<Values>({
    initialValues: form.values,
    getValues: () => form.values,
    validate: async () => (validate ? validate(form.values) : form.values),
    save: async (args) => {
      saves.push(args)
      await save?.(args)
    },
    onStateChange: (state) => states.push(state),
  })
  const edit = (changes: Partial<Values>) => {
    form.values = { ...form.values, ...changes }
    autosaver.notifyChange()
  }
  return { autosaver, edit, states, saves }
}

describe("createAutosaver", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it("saves the changed fields once the user pauses", async () => {
    const { edit, states, saves } = setup()

    edit({ title: "Pricing 2" })
    expect(states).toEqual(["saving"])
    expect(saves).toHaveLength(0)

    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS)

    expect(saves).toHaveLength(1)
    expect(saves[0]?.changed).toEqual({ title: "Pricing 2" })
    expect(saves[0]?.previous).toEqual({ title: "Pricing", summary: "Plans and prices" })
    expect(states).toEqual(["saving", "saved"])
  })

  it("groups the changes of a burst of edits in one save", async () => {
    const { edit, saves } = setup()

    edit({ title: "Pricing 2" })
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS - 1)
    edit({ summary: "Plans" })
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS - 1)
    expect(saves).toHaveLength(0)

    await vi.advanceTimersByTimeAsync(1)

    expect(saves).toHaveLength(1)
    expect(saves[0]?.changed).toEqual({ title: "Pricing 2", summary: "Plans" })
  })

  it("saves nothing when the user goes back to the saved values", async () => {
    const { edit, states, saves } = setup()

    edit({ title: "Pricing 2" })
    edit({ title: "Pricing" })
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS)

    expect(saves).toHaveLength(0)
    expect(states).toEqual(["saving", "saved"])
  })

  it("saves right away on flush", async () => {
    const { autosaver, edit, saves, states } = setup()

    edit({ title: "Pricing 2" })
    await autosaver.flush()

    expect(saves).toHaveLength(1)
    expect(states).toEqual(["saving", "saved"])
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS)
    expect(saves).toHaveLength(1)
  })

  it("saves again what the user changed while a save was running", async () => {
    let release: () => void = () => {}
    const { edit, saves, states } = setup({
      save: () =>
        new Promise<void>((resolve) => {
          release = resolve
        }),
    })

    edit({ title: "Pricing 2" })
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS)
    expect(saves).toHaveLength(1)

    edit({ title: "Pricing 3" })
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS)
    // One save at a time: the second one waits for the first.
    expect(saves).toHaveLength(1)

    release()
    await vi.advanceTimersByTimeAsync(0)
    expect(saves).toHaveLength(2)
    expect(saves[1]?.changed).toEqual({ title: "Pricing 3" })
    expect(saves[1]?.previous.title).toBe("Pricing 2")

    release()
    await vi.advanceTimersByTimeAsync(0)
    expect(states).toEqual(["saving", "saved"])
  })

  it("keeps invalid values unsaved, then saves them once fixed", async () => {
    const { edit, saves, states } = setup({
      validate: (values) => (values.title.length < 3 ? null : values),
    })

    edit({ title: "Pr" })
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS)
    expect(saves).toHaveLength(0)
    expect(states).toEqual(["saving", "unsaved"])

    edit({ title: "Product" })
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS)
    expect(saves).toHaveLength(1)
    expect(saves[0]?.changed).toEqual({ title: "Product" })
    expect(states).toEqual(["saving", "unsaved", "saving", "saved"])
  })

  it("sends the validated values and compares the raw ones", async () => {
    const { edit, saves, states } = setup({
      validate: (values) => ({ ...values, title: values.title.trim() }),
    })

    edit({ title: "Product " })
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS)

    expect(saves).toHaveLength(1)
    expect(saves[0]?.changed).toEqual({ title: "Product" })
    // The trimmed value differs from the typed one: this must not start a save loop.
    expect(states).toEqual(["saving", "saved"])
  })

  it("stays unsaved when the save fails, and sends the same fields again on retry", async () => {
    let failing = true
    const { autosaver, edit, saves, states } = setup({
      save: async () => {
        if (failing) throw new Error("Network error")
      },
    })

    edit({ title: "Pricing 2" })
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS)
    expect(states).toEqual(["saving", "unsaved"])

    failing = false
    await autosaver.flush()

    expect(saves).toHaveLength(2)
    expect(saves[1]?.changed).toEqual({ title: "Pricing 2" })
    expect(states).toEqual(["saving", "unsaved", "saving", "saved"])
  })

  it("saves nothing once disposed", async () => {
    const { autosaver, edit, saves } = setup()

    edit({ title: "Pricing 2" })
    autosaver.dispose()
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS)

    expect(saves).toHaveLength(0)
  })
})
