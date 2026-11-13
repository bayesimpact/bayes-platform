import { configureStore } from "@reduxjs/toolkit"
import i18next from "i18next"
import { renderToStaticMarkup } from "react-dom/server"
import { I18nextProvider, initReactI18next } from "react-i18next"
import { Provider } from "react-redux"
import { describe, expect, it } from "vitest"
import { agentSessionMessageFactory } from "@/common/features/agents/agent-sessions/agent-session.factory"
import feedbackTexts from "@/studio/features/agent-message-feedback/locales/agent-message-feedback.en.json"
import { FeedbackCreator } from "./FeedbackCreator"

// The app's i18n setup reads the DOM, which the node environment of these tests lacks.
const i18n = i18next.createInstance()
await i18n.use(initReactI18next).init({ lng: "en", resources: { en: feedbackTexts } })

function renderFeedbackCreator() {
  const message = agentSessionMessageFactory.build({ role: "assistant" })
  return renderToStaticMarkup(
    <I18nextProvider i18n={i18n}>
      <Provider store={configureStore({ reducer: () => ({}) })}>
        <FeedbackCreator message={message} />
      </Provider>
    </I18nextProvider>,
  )
}

/** The opening tag of the button whose accessible name is `label`. */
function findButton(markup: string, label: string) {
  return markup.match(new RegExp(`<button[^>]*aria-label="${label}"[^>]*>`))?.[0]
}

describe("FeedbackCreator", () => {
  it("gives the thumbs-up its own button, which opens no dialog", () => {
    const thumbsUp = findButton(renderFeedbackCreator(), "Good answer")

    expect(thumbsUp).toBeDefined()
    expect(thumbsUp).not.toContain('aria-haspopup="dialog"')
  })

  it("opens the report form from the thumbs-down", () => {
    const thumbsDown = findButton(renderFeedbackCreator(), "Report a problem")

    expect(thumbsDown).toContain('aria-haspopup="dialog"')
  })
})
