import "../src/styles/global.css"
import type { Preview } from "@storybook/react-vite"
import { activateLocale, LOCALES, type Locale } from "@/app/i18n"
import { serveStoryWorld } from "@/test/msw/story-worker"

const isLocale = (value: unknown): value is Locale => LOCALES.some((locale) => locale === value)

const preview: Preview = {
  globalTypes: {
    locale: {
      description: "The language of the Desk",
      toolbar: {
        icon: "globe",
        items: [
          { value: "en", title: "English" },
          { value: "fr", title: "Français" },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { locale: "en" },
  parameters: { layout: "fullscreen" },
  // Each story starts from its own world on the mocked API, in the language of the toolbar.
  loaders: [
    async ({ globals, parameters }) => {
      await activateLocale(isLocale(globals.locale) ? globals.locale : "en")
      return { deskUrl: await serveStoryWorld(parameters.desk) }
    },
  ],
}

export default preview
