import { useLingui } from "@lingui/react"
import { composeStories, composeStory, setProjectAnnotations } from "@storybook/react-vite"
import { useQueryClient } from "@tanstack/react-query"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import previewAnnotations from "../../.storybook/preview"
import * as conversationStories from "./Conversation.stories"
import * as generalStories from "./Desk.stories"
import * as extractionStories from "./Extraction.stories"

setProjectAnnotations(previewAnnotations)

/** A component that needs what Storybook gives a story of one component: a locale and a cache. */
function LocaleAndCache() {
  const { i18n } = useLingui()
  const isRetrying = useQueryClient().getDefaultOptions().queries?.retry !== false
  return <p>{`Locale ${i18n.locale}, ${isRetrying ? "retrying" : "not retrying"}`}</p>
}

const { HistoryFailsToLoad, PageNotFound, ProjectsFailToLoad, Loading, ...generalPages } =
  composeStories(generalStories)
const { ReplyFails, ...conversationPages } = composeStories(conversationStories)
const { DocumentDetails, ...extractionPages } = composeStories(extractionStories)
/** The stories of a page, from the three folders of Storybook. */
const pageStories = {
  ...generalPages,
  ...conversationPages,
  ...extractionPages,
}

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
  QuotedMessage: {
    Story: pageStories.QuotedMessage,
    loaded: () => screen.findByText("two plans", { selector: "code" }),
  },
  LongConversation: {
    Story: pageStories.LongConversation,
    loaded: () => screen.findByRole("heading", { name: "What the billing team should check" }),
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
  ExtractionPending: {
    Story: pageStories.ExtractionPending,
    loaded: () => screen.findByText("The agent is reading the document…"),
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

  it("ReplyFails shows the server's reason once its message is sent, and answers the retry", async () => {
    await ReplyFails.load()
    const { container } = render(<ReplyFails />)
    await ReplyFails.play?.({ canvasElement: container })

    const alert = await screen.findByRole("alert")
    expect(within(alert).getByText("The model is overloaded")).toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: "Retry" }))
    expect(await screen.findByText(/Here is what I found about "Hello"/)).toBeInTheDocument()
  })

  it("DocumentDetails opens the details of a document beside the page", async () => {
    await DocumentDetails.load()
    const { container } = render(<DocumentDetails />)
    await DocumentDetails.play?.({ canvasElement: container })

    const panel = await screen.findByRole("complementary", { name: "quarterly-report.pdf" })
    expect(within(panel).getByRole("heading", { name: "Quarterly report" })).toBeInTheDocument()
  })

  it("HistoryFailsToLoad keeps the page, and loads the history on its retry", async () => {
    await HistoryFailsToLoad.load()
    render(<HistoryFailsToLoad />)

    expect(await screen.findByText("The history could not load.")).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "How can I help you today?" })).toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: "Try again" }))
    expect(await screen.findByRole("link", { name: "Compare the plans" })).toBeInTheDocument()
  })

  it("PageNotFound says so", async () => {
    await PageNotFound.load()
    render(<PageNotFound />)

    expect(await screen.findByText("Page not found")).toBeInTheDocument()
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
