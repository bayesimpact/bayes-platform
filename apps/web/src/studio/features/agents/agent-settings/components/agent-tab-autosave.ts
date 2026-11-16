import { cloneDeep, isEqual } from "lodash"

/**
 * Where a tab stands with its changes:
 * - `saved`: the draft holds everything the tab shows.
 * - `saving`: a change waits for its save, or the save is running. It needs nothing from the user.
 * - `unsaved`: the changes cannot be saved as they are (invalid value, failed request), or the
 *   tab saves with a button and the user did not press it. Leaving the tab loses them.
 */
export type TabSaveState = "saved" | "saving" | "unsaved"

/** How long the user must pause before a change is saved. */
export const AUTOSAVE_DELAY_MS = 700

export type AutosaveArgs<TValues> = {
  /** Every value of the form, validated. */
  values: TValues
  /** The validated values of the fields that differ from the last save. */
  changed: Partial<TValues>
  /** The values of the last save, as the form held them. */
  previous: TValues
}

export type Autosaver = {
  /** The form changed: plan a save once the user pauses. */
  notifyChange: () => void
  /** Save now what is not saved yet. Resolves once nothing is left to try. */
  flush: () => Promise<void>
  /** Drop the planned save. A running save still completes. */
  dispose: () => void
}

/**
 * Saves a form as the user edits it: one save at a time, after a short pause, with only the
 * fields that changed since the last save. It knows nothing about React or the form library.
 */
export function createAutosaver<TValues extends object>({
  initialValues,
  getValues,
  validate,
  save,
  onStateChange,
  delayMs = AUTOSAVE_DELAY_MS,
}: {
  initialValues: TValues
  /** The values the form holds now, as typed (not validated). */
  getValues: () => TValues
  /** The validated values, or null when the form is invalid. It also shows the field errors. */
  validate: () => Promise<TValues | null>
  /** Rejects when the save failed. */
  save: (args: AutosaveArgs<TValues>) => Promise<void>
  onStateChange: (state: TabSaveState) => void
  delayMs?: number
}): Autosaver {
  // Compared with what the user typed, not with what validation returns: a schema may trim or
  // coerce a value, and comparing the two would start a save on every pass.
  let savedValues = cloneDeep(initialValues)
  let state: TabSaveState = "saved"
  let timer: ReturnType<typeof setTimeout> | null = null
  let running: Promise<void> | null = null
  let disposed = false

  const setState = (next: TabSaveState) => {
    if (next === state || disposed) return
    state = next
    onStateChange(next)
  }

  const clearTimer = () => {
    if (timer) clearTimeout(timer)
    timer = null
  }

  const saveUntilUpToDate = async () => {
    // The user can keep typing while a save runs: loop until the draft holds the form.
    while (!disposed) {
      if (isEqual(getValues(), savedValues)) return setState("saved")
      setState("saving")

      const values = await validate()
      if (!values) return setState("unsaved")

      const rawValues = cloneDeep(getValues())
      try {
        await save({
          values,
          changed: pickChangedFields({ values, rawValues, savedValues }),
          previous: savedValues,
        })
      } catch {
        return setState("unsaved")
      }
      savedValues = rawValues
    }
  }

  const flush = () => {
    clearTimer()
    running ??= saveUntilUpToDate().finally(() => {
      running = null
    })
    return running
  }

  const notifyChange = () => {
    clearTimer()
    if (isEqual(getValues(), savedValues)) {
      // Back to the saved values. A running save settles the state itself.
      if (!running) setState("saved")
      return
    }
    setState("saving")
    timer = setTimeout(() => void flush(), delayMs)
  }

  const dispose = () => {
    clearTimer()
    disposed = true
  }

  return { notifyChange, flush, dispose }
}

function pickChangedFields<TValues extends object>({
  values,
  rawValues,
  savedValues,
}: {
  values: TValues
  rawValues: TValues
  savedValues: TValues
}): Partial<TValues> {
  const changed: Partial<TValues> = {}
  for (const key of Object.keys(rawValues) as (keyof TValues)[]) {
    if (!isEqual(rawValues[key], savedValues[key])) changed[key] = values[key]
  }
  return changed
}
