import { i18n } from "@lingui/core"
import { I18nProvider } from "@lingui/react"
import { render } from "@testing-library/react"
import type { ReactElement } from "react"

/** Renders a component in English, the source of its messages (activated in setup.ts). */
export function renderWithI18n(ui: ReactElement) {
  return render(<I18nProvider i18n={i18n}>{ui}</I18nProvider>)
}
