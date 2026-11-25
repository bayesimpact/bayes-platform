import "../src/styles/global.css"
import type { Preview } from "@storybook/react-vite"
import { INITIAL_VIEWPORTS } from "storybook/viewport"
import { activateLocale, detectLocale, isLocale, LOCALES, languageNameOf } from "@/app/i18n"
import { StoryProviders } from "@/stories/StoryProviders"
import { type EvalStoryParameters, serveStoryWorld } from "@/test/msw/story-api"

const preview: Preview = {
  // A story of the whole app sets its `evaluation` parameter and brings its own providers; a story of
  // one component gets them here, afresh for each story.
  decorators: [
    (Story, { id, parameters }) => {
      const evalParameters: EvalStoryParameters | undefined = parameters.evaluation
      return evalParameters ? (
        <Story />
      ) : (
        <StoryProviders key={id}>
          <Story />
        </StoryProviders>
      )
    },
  ],
  globalTypes: {
    locale: {
      description: "The language of the app",
      toolbar: {
        icon: "globe",
        items: LOCALES.map((locale) => ({ value: locale, title: languageNameOf(locale) })),
        dynamicTitle: true,
      },
    },
  },
  // The browser's language first, as the app itself, so a French browser opens it in French.
  initialGlobals: { locale: detectLocale() },
  parameters: {
    layout: "fullscreen",
    // The app around its pages first; each area of the app adds its folder after it.
    options: {
      storySort: {
        order: ["Evaluation", ["General", "Review campaigns", "Reviewer", "Tester"]],
      },
    },
    viewport: {
      options: {
        ...INITIAL_VIEWPORTS,
        iphoneSE: {
          name: "iPhone SE (375px)",
          styles: { width: "375px", height: "667px" },
          type: "mobile",
        },
        iphone14: {
          name: "iPhone 14 (390px)",
          styles: { width: "390px", height: "844px" },
          type: "mobile",
        },
      },
    },
  },
  // Each story starts from its own world on the mocked API, in the language of the toolbar.
  loaders: [
    async ({ globals, parameters }) => {
      await activateLocale(isLocale(globals.locale) ? globals.locale : "en")
      const evalParameters: EvalStoryParameters | undefined = parameters.evaluation
      return { evalUrl: serveStoryWorld(evalParameters) }
    },
  ],
}

export default preview
