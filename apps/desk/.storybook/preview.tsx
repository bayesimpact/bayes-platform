import "../src/styles/global.css"
import type { Preview } from "@storybook/react-vite"
import { INITIAL_VIEWPORTS } from "storybook/viewport"
import { activateLocale, detectLocale, LOCALES, type Locale } from "@/app/i18n"
import { StoryProviders } from "@/stories/StoryProviders"
import { type DeskStoryParameters, serveStoryWorld } from "@/test/msw/story-api"

const isLocale = (value: unknown): value is Locale => LOCALES.some((locale) => locale === value)

const preview: Preview = {
  // A story of the whole Desk sets its `desk` parameter and brings its own providers; a story of
  // one component gets them here, afresh for each story.
  decorators: [
    (Story, { id, parameters }) => {
      const deskParameters: DeskStoryParameters | undefined = parameters.desk
      return deskParameters ? (
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
  // The browser's language first, as the Desk itself, so a French browser opens it in French.
  initialGlobals: { locale: detectLocale() },
  parameters: {
    layout: "fullscreen",
    // The Desk around its pages first, then its two kinds of agents.
    options: { storySort: { order: ["Desk", ["General", "Conversation", "Extraction"]] } },
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
      const deskParameters: DeskStoryParameters | undefined = parameters.desk
      return { deskUrl: serveStoryWorld(deskParameters) }
    },
  ],
}

export default preview
