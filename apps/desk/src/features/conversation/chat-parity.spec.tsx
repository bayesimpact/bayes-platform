import { TOOL_NAMES } from "@caseai-connect/desk-contracts"
import { prettyDOM, screen } from "@testing-library/react"
import { useState } from "react"
import { describe, expect, it } from "vitest"
import { randomConversationParams, renderWithQueryClient } from "@/test/render-with-query-client"
import { toChatMessages } from "./chat-messages"
import { ChatMessageView } from "./components/ChatMessageView"
import { useCitedPassages } from "./hooks/use-cited-passages"
import { useTaskChecks } from "./hooks/use-task-checks"

/**
 * The same conversation renders the same in the Desk and in Evaluation, whose chat is a copy of
 * the Desk's. Both apps hold this spec: each writes what it renders to
 * `__snapshots__/chat-parity.html`, and Evaluation's `check:desk-parity` compares the two files.
 */

const STARTED_AT = Date.UTC(2026, 0, 15, 10, 0)

// Fixed ids, unlike the other specs: the markup carries some of them, and both apps must render
// the same.
const QUESTION_ID = "00000000-0000-4000-8000-000000000001"
const REPLY_ID = "00000000-0000-4000-8000-000000000002"
const DOCUMENT_ID = "00000000-0000-4000-8000-000000000003"

const messages = toChatMessages([
  {
    id: QUESTION_ID,
    role: "user",
    content: "Which plan should a team of five pick?",
    status: "completed",
    createdAt: STARTED_AT,
  },
  {
    id: REPLY_ID,
    role: "assistant",
    content: [
      "For a team of five, the **Pro** plan fits best:",
      "",
      "- shared workspaces",
      "- five seats included",
      "",
      "| Plan | Seats |",
      "| --- | --- |",
      "| Starter | 1 |",
      "| Pro | 5 |",
      "",
      "Set it up with `plan: pro`.",
    ].join("\n"),
    status: "completed",
    createdAt: STARTED_AT + 4000,
    toolCalls: [
      { id: "call-lookup", name: TOOL_NAMES.lookupKnowledgeBase, arguments: { query: "plans" } },
      {
        id: "call-sources",
        name: TOOL_NAMES.sources,
        arguments: {
          sources: [
            {
              documentId: DOCUMENT_ID,
              documentTitle: "Pricing guide.pdf",
              documentSourceType: "project",
              chunks: [{ chunkId: "chunk-1", partialContent: "The Pro plan covers five seats…" }],
            },
          ],
        },
      },
      {
        id: "call-resources",
        name: TOOL_NAMES.surfaceResources,
        arguments: {
          resources: [
            {
              id: "resource-1",
              title: "Plans compared",
              description: "Every plan, side by side.",
              link: "https://example.org/plans",
            },
          ],
        },
      },
    ],
  },
])

/** The two messages as the conversation shows them, with the follow-up questions of the last. */
function ParityConversation() {
  const [conversation] = useState(randomConversationParams)
  const taskChecks = useTaskChecks(messages)
  const citedPassages = useCitedPassages(messages, null)
  return (
    <ol>
      {messages.map((message, position) => (
        <li key={message.id}>
          <ChatMessageView
            conversation={conversation}
            message={message}
            now={STARTED_AT + 60_000}
            hasSourcesTool
            appsHtml={{ htmls: [], isPending: false }}
            onAppMessage={() => {}}
            onOpenResource={() => {}}
            citedPassages={citedPassages}
            taskChecks={taskChecks}
            followUpQuestions={position === messages.length - 1 ? ["Can we switch later?"] : []}
            onFollowUpQuestion={() => {}}
          />
        </li>
      ))}
    </ol>
  )
}

/** The rendered markup, without the ids each render draws anew. */
function markupOf(element: Element): string {
  const markup = prettyDOM(element, Number.POSITIVE_INFINITY, { highlight: false })
  return `${String(markup).replaceAll(/ (id|for|aria-controls|aria-labelledby|aria-describedby)="[^"]*"/g, "")}\n`
}

describe("the chat's parity with the Desk", () => {
  it("renders a reply with its steps, text, sources, resources and follow-up questions", async () => {
    const { container } = renderWithQueryClient(<ParityConversation />)

    expect(await screen.findByText("Can we switch later?")).toBeInTheDocument()
    await expect(markupOf(container)).toMatchFileSnapshot("__snapshots__/chat-parity.html")
  })
})
