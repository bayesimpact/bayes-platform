import { useLingui } from "@lingui/react"
import { composeStories, composeStory, setProjectAnnotations } from "@storybook/react-vite"
import { useQueryClient } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import previewAnnotations from "../../.storybook/preview"
import * as stories from "./Desk.stories"

setProjectAnnotations(previewAnnotations)

/** A component that needs what Storybook gives a story of one component: a locale and a cache. */
function LocaleAndCache() {
  const { i18n } = useLingui()
  const isRetrying = useQueryClient().getDefaultOptions().queries?.retry !== false
  return <p>{`Locale ${i18n.locale}, ${isRetrying ? "retrying" : "not retrying"}`}</p>
}

const { ProjectsFailToLoad, Loading, ...pageStories } = composeStories(stories)

/** Each story of a page, and what it shows once that page loaded: every story is listed. */
const PAGES = {
  Home: {
    Story: pageStories.Home,
    loaded: () => screen.findByRole("heading", { name: "How can I help you today?" }),
  },
  Conversation: {
    Story: pageStories.Conversation,
    loaded: () => screen.findByText(/Here is a short comparison/),
  },
  FirstConversation: {
    Story: pageStories.FirstConversation,
    loaded: () => screen.findByText("No conversations yet"),
  },
  SeveralAgents: {
    Story: pageStories.SeveralAgents,
    loaded: () => screen.findByRole("heading", { name: "What should Document Reader read?" }),
  },
  SeveralProjects: {
    Story: pageStories.SeveralProjects,
    loaded: () => screen.findByRole("combobox", { name: /Switch agent/ }),
  },
  NoAgent: {
    Story: pageStories.NoAgent,
    loaded: () => screen.findByText("You don't have access to an agent yet"),
  },
  TermsToAccept: {
    Story: pageStories.TermsToAccept,
    loaded: () => screen.findByRole("heading", { name: "Before you start" }),
  },
  NewExtraction: {
    Story: pageStories.NewExtraction,
    loaded: () => screen.findByRole("heading", { name: "What should Document Reader read?" }),
  },
  ExtractionResult: {
    Story: pageStories.ExtractionResult,
    loaded: () => screen.findByRole("heading", { name: "quarterly-report.pdf" }),
  },
  ExtractionFailure: {
    Story: pageStories.ExtractionFailure,
    loaded: () => screen.findByText(/The document has more pages than the agent can read at once/),
  },
  CsvSetup: {
    Story: pageStories.CsvSetup,
    loaded: () => screen.findByRole("heading", { name: "articles.csv" }),
  },
  CsvRun: {
    Story: pageStories.CsvRun,
    loaded: () => screen.findByText("24 of 24 rows"),
  },
} satisfies Record<keyof typeof pageStories, unknown>

/** The pages the Desk shows when something went wrong. */
const ERROR_PAGES = [
  "This page could not load",
  "Page not found",
  "A new version of the Desk is available",
]

const expectNoErrorPage = () => {
  for (const title of ERROR_PAGES) expect(screen.queryByText(title)).not.toBeInTheDocument()
}

describe("the stories of the Desk", () => {
  it.each(Object.entries(PAGES))("%s opens its page", async (_name, { Story, loaded }) => {
    await Story.load()
    render(<Story />)

    expect(await loaded()).toBeInTheDocument()
    expectNoErrorPage()
  })

  it("ProjectsFailToLoad shows its error at once, with a retry", async () => {
    await ProjectsFailToLoad.load()
    render(<ProjectsFailToLoad />)

    expect(await screen.findByText("This page could not load")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument()
  })

  it("Loading shows the frame of the Desk, and no page yet", async () => {
    await Loading.load()
    render(<Loading />)

    expect(await screen.findByRole("main")).toBeInTheDocument()
    expect(screen.queryByRole("heading")).not.toBeInTheDocument()
    expectNoErrorPage()
  })
})

describe("a story of one component", () => {
  it("gets the language of the toolbar and a cache whose queries do not retry", async () => {
    const Story = composeStory({ render: () => <LocaleAndCache /> }, { title: "Component" })
    await Story.load()
    render(<Story />)

    expect(screen.getByText("Locale en, not retrying")).toBeInTheDocument()
  })
})
