import { type FormEvent, type RefObject, useEffect, useRef } from "react"
import type { FieldValues, UseFormReturn } from "react-hook-form"
import type { AgentSettings } from "@/common/features/agents/agent-settings/agent-settings.models"
import { type AutosaveArgs, createAutosaver, type TabSaveState } from "./agent-tab-autosave"

/** What the editor hands to a tab that saves by itself. */
export type TabSaveControl = {
  /** `reason` says why a save failed, when the failure gave one. */
  onStateChange: (state: TabSaveState, reason?: string) => void
  /** The tab puts here how to save now what waits for its pause. The editor calls it before it leaves the tab. */
  flushRef: RefObject<(() => void) | null>
}

/**
 * A tab that writes to the draft is a self-contained form: its own `useForm` and its own update
 * thunk. It has no Save button: `useAutosave` saves each change after a short pause.
 */
export type AgentTabFormProps = {
  agentSettings: AgentSettings
  saveControl: TabSaveControl
}

/**
 * Save the form in the draft as the user edits it, and tell the editor where the tab stands.
 * `save` receives the validated values and the fields that changed since the last save; it must
 * reject when the request fails. The form must be created with `shouldFocusError: false`: an
 * invalid value must not pull the focus away from the field the user is typing in.
 *
 * Returns the `onSubmit` of the `<form>`: Enter in a field saves now instead of reloading the page.
 */
export function useAutosave<TValues extends FieldValues>({
  form,
  save,
  saveControl,
}: {
  form: UseFormReturn<TValues>
  save: (args: AutosaveArgs<TValues>) => Promise<void>
  saveControl: TabSaveControl
}): { onSubmit: (event: FormEvent) => void } {
  // The autosaver lives as long as the tab: it reads the latest props through this ref.
  const latest = useRef({ save, saveControl })
  useEffect(() => {
    latest.current = { save, saveControl }
  })

  useEffect(() => {
    const { saveControl: control } = latest.current
    const autosaver = createAutosaver<TValues>({
      initialValues: form.getValues(),
      getValues: () => form.getValues(),
      validate: () =>
        new Promise<TValues | null>((resolve) => {
          void form.handleSubmit(
            (values) => resolve(values),
            () => resolve(null),
          )()
        }),
      save: (args) => latest.current.save(args),
      onStateChange: (state, reason) => latest.current.saveControl.onStateChange(state, reason),
    })
    control.flushRef.current = () => void autosaver.flush()
    const unsubscribe = form.subscribe({
      formState: { values: true },
      callback: () => autosaver.notifyChange(),
    })

    return () => {
      unsubscribe()
      autosaver.dispose()
      control.flushRef.current = null
      // The editor mounts only the active tab: a tab that goes away has nothing left to report.
      latest.current.saveControl.onStateChange("saved")
    }
  }, [form])

  return {
    onSubmit: (event) => {
      event.preventDefault()
      saveControl.flushRef.current?.()
    },
  }
}

/**
 * For a section that saves with a button (its changes go live at once, they are not part of the
 * draft): report its dirty state up to the editor, and clear it when the section unmounts.
 */
export function useReportDirty(isDirty: boolean, onDirtyChange: (dirty: boolean) => void): void {
  useEffect(() => {
    onDirtyChange(isDirty)
    return () => onDirtyChange(false)
  }, [isDirty, onDirtyChange])
}
