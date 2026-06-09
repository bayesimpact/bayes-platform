import { useEffect } from "react"

const HELP_SCRIPT_ID = "agentstudio-help-launcher"

export function useHelpLauncher() {
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
    script.dataset.displayMode = "drawer"
    script.dataset.token = token
    script.dataset.hint = "Need help? Ask us!"
    document.body.appendChild(script)
  }, [])
}
