import { I18nProvider } from "@lingui/react"
import { render } from "@testing-library/react"
import type { ReactElement } from "react"
import { i18n } from "@/app/i18n"

/** Renders a component with the locale the test activated (English by default, in setup.ts). */
export function renderWithI18n(ui: ReactElement) {
  return render(<I18nProvider i18n={i18n}>{ui}</I18nProvider>)
}
