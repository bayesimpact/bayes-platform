import { useEffect } from "react"
import { useTranslation } from "react-i18next"
import i18n from "@/i18n"

declare global {
  interface Window {
    __agentStudioSetHint?: (text: string) => void
  }
}

const HELP_SCRIPT_ID = "agentstudio-help-launcher"

/**
 * Resolves a hint string from the env var value.
 *
 * The env var can be either:
 *   - A plain string:  "Need help? Ask us!"
 *   - A JSON object:   {"en":"Need help?","fr":"Besoin d'aide ?"}
 *
 * For JSON values the best matching language is selected using the
 * following fallback chain: exact locale → "en" → first key.
 */
function resolveHint(raw: string, locale: string): string {
  try {
    const parsed: unknown = JSON.parse(raw)
    if (parsed !== null && typeof parsed === "object") {
      const map = parsed as Record<string, string>
      return map[locale] ?? map.en ?? (Object.values(map)[0] as string) ?? raw
    }
  } catch (error) {
    console.error("Failed to parse hint JSON:", error)
    // Not JSON — use the raw string as-is.
  }
  return raw
}

export function useHelpLauncher() {
  // Reactive i18n reference — triggers a re-render when the user changes language.
  const { i18n: reactiveI18n } = useTranslation()

  // Inject the launcher script once on mount.
  useEffect(() => {
    const token = import.meta.env.VITE_HELP_AGENT_EMBED_TOKEN as string | undefined
    if (!token || document.getElementById(HELP_SCRIPT_ID)) return

    const embedBaseUrl =
      (import.meta.env.VITE_AGENT_EMBED_URL as string | undefined) ?? window.location.origin
    const script = document.createElement("script")
    script.id = HELP_SCRIPT_ID
    script.src = `${embedBaseUrl}/launcher.js`

    const color = import.meta.env.VITE_HELP_AGENT_EMBED_COLOR as string | undefined
    if (color) script.dataset.color = color

    const hintRaw = import.meta.env.VITE_HELP_AGENT_EMBED_HINT as string | undefined
    if (hintRaw) script.dataset.hint = resolveHint(hintRaw, i18n.language)

    script.dataset.displayMode = "drawer"
    script.dataset.token = token
    script.dataset.locale = i18n.language

    document.body.appendChild(script)
  }, [])

  // Update the hint bubble text in-place when the user changes language.
  // Skipped on the first render (the injection effect above already set it).
  useEffect(() => {
    const hintRaw = import.meta.env.VITE_HELP_AGENT_EMBED_HINT as string | undefined
    if (!hintRaw) return
    window.__agentStudioSetHint?.(resolveHint(hintRaw, reactiveI18n.language))
  }, [reactiveI18n.language])
}
