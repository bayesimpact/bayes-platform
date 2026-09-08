import { type AgentSessionMessageDto, ToolName } from "@caseai-connect/api-contracts"

let idCounter = 1
function nextId() {
  return `msg-${idCounter++}`
}

export function buildUserMessage(
  content: string,
  overrides?: Partial<AgentSessionMessageDto>,
): AgentSessionMessageDto {
  return {
    id: nextId(),
    role: "user",
    content,
    status: "completed",
    createdAt: Date.now(),
    ...overrides,
  }
}

export function buildAssistantMessage(
  content: string,
  overrides?: Partial<AgentSessionMessageDto>,
): AgentSessionMessageDto {
  return {
    id: nextId(),
    role: "assistant",
    content,
    status: "completed",
    createdAt: Date.now(),
    ...overrides,
  }
}

export function buildStreamingMessage(partialContent = ""): AgentSessionMessageDto {
  return buildAssistantMessage(partialContent, { status: "streaming" })
}

export function buildErrorMessage(): AgentSessionMessageDto {
  return buildAssistantMessage("", { status: "error" })
}

// ---------------------------------------------------------------------------
// Canned conversation fixtures
// ---------------------------------------------------------------------------

export const emptyConversation: AgentSessionMessageDto[] = []

export const shortConversation: AgentSessionMessageDto[] = [
  buildUserMessage("Hello! What can you help me with?"),
  buildAssistantMessage(
    "Hi there! I'm your support assistant. I can help you with account questions, product information, troubleshooting, and more. What do you need today?",
  ),
]

export const longConversation: AgentSessionMessageDto[] = [
  buildUserMessage("Hi, I'm having trouble logging in."),
  buildAssistantMessage(
    "I'm sorry to hear that. Let's get this sorted out. Could you describe what happens when you try to log in?",
  ),
  buildUserMessage("It says my password is incorrect but I'm sure it's right."),
  buildAssistantMessage(
    "That can be frustrating! Here are a few things to try:\n\n1. **Reset your password** — use the *Forgot password* link on the login page.\n2. **Check caps lock** — passwords are case-sensitive.\n3. **Clear your browser cache** — sometimes cached credentials cause issues.\n\nWould you like me to send a password reset email to the address on your account?",
  ),
  buildUserMessage("Yes please, that would be great."),
  buildAssistantMessage(
    "Done! A reset link has been sent. It should arrive within a minute or two. If you don't see it, check your spam folder.\n\nIs there anything else I can help you with?",
  ),
]

export const markdownConversation: AgentSessionMessageDto[] = [
  buildUserMessage("Can you show me an example with formatting?"),
  buildAssistantMessage(
    `Sure! Here's a quick demo:\n\n## Headings work\n\nAnd **bold**, *italic*, and \`inline code\` too.\n\n### Lists\n\n- Item one\n- Item two\n- Item three\n\n### Code block\n\n\`\`\`\nnpm install react\n\`\`\`\n\nAnd [links open in a new tab](https://example.com).`,
  ),
]

export const resourceCardsConversation: AgentSessionMessageDto[] = [
  buildUserMessage("Do you have a pricing guide?"),
  buildAssistantMessage("Here is the pricing guide and a short product overview.", {
    toolCalls: [
      {
        id: "tool-surface-1",
        name: ToolName.SurfaceResources,
        arguments: {
          resources: [
            {
              id: "aaaaaaaa-0000-4000-8000-000000000001",
              title: "Pricing guide",
              description: "Current product pricing and plan comparison.",
              link: "https://example.com/pricing",
            },
            {
              id: "aaaaaaaa-0000-4000-8000-000000000002",
              title: "Product overview",
              description: "Two-minute walkthrough of the main features.",
              link: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            },
          ],
        },
      },
    ],
  }),
]

export const sourcesConversation: AgentSessionMessageDto[] = [
  buildUserMessage("What is the return policy?"),
  buildAssistantMessage(
    "You can return unused items within 30 days of delivery. Keep the original packaging when you can.",
    {
      toolCalls: [
        {
          id: "tool-sources-1",
          name: ToolName.Sources,
          arguments: {
            sources: [
              {
                documentId: "aaaaaaaa-0000-4000-8000-000000000010",
                documentTitle: "Returns handbook",
                documentSourceType: "project",
                chunks: [
                  {
                    chunkId: "chunk-1",
                    partialContent:
                      "Unused items may be returned within 30 days of delivery. Original packaging is recommended.",
                  },
                ],
              },
              {
                documentId: "aaaaaaaa-0000-4000-8000-000000000011",
                documentTitle: "Help center — Returns",
                documentSourceType: "webCrawl",
                chunks: [
                  {
                    chunkId: "chunk-2",
                    partialContent:
                      "Start a return from your orders page. A prepaid label is emailed once the request is approved.",
                  },
                ],
              },
            ],
          },
        },
      ],
    },
  ),
]

export const resourceCardsOnlyConversation: AgentSessionMessageDto[] = [
  buildUserMessage("Show me the support handbook."),
  buildAssistantMessage("", {
    toolCalls: [
      {
        id: "tool-surface-2",
        name: ToolName.SurfaceResources,
        arguments: {
          resources: [
            {
              id: "aaaaaaaa-0000-4000-8000-000000000003",
              title: "Support handbook",
              description: "How to open a ticket and what to include.",
              link: "https://example.com/support-handbook",
            },
          ],
        },
      },
    ],
  }),
]

/**
 * A reply whose MCP App card HTML is still being read from the MCP server: the transcript is on
 * screen and the card holds its place with a placeholder.
 */
export const loadingMcpAppCardConversation: AgentSessionMessageDto[] = [
  buildUserMessage("Export these notes as a PDF."),
  buildAssistantMessage("", {
    toolCalls: [
      {
        id: "call-pdf-export",
        name: "export_pdf",
        arguments: { markdown: "# Notes" },
        result: {
          content: [{ type: "text", text: "Created Notes.pdf (2 pages)." }],
          structuredContent: { fileName: "Notes.pdf" },
        },
        mcpApp: { mcpServerId: "mcp-server-1", resourceUri: "ui://pdf-export/mcp-app.html" },
      },
    ],
  }),
]

/**
 * A reply with no prose whose MCP App card never completes its handshake. The card gives up
 * after its 15 s initialization timeout and the tool result text takes its place in the bubble.
 */
export const failedMcpAppCardConversation: AgentSessionMessageDto[] = [
  buildUserMessage("Export these notes as a PDF."),
  buildAssistantMessage("", {
    toolCalls: [
      {
        id: "call-pdf-export",
        name: "export_pdf",
        arguments: { markdown: "# Notes" },
        result: {
          content: [
            {
              type: "text",
              text: "Created Notes.pdf (2 pages). Download: https://example.com/notes.pdf",
            },
          ],
          structuredContent: {
            fileName: "Notes.pdf",
            downloadUrl: "https://example.com/notes.pdf",
          },
        },
        mcpApp: {
          mcpServerId: "mcp-server-1",
          resourceUri: "ui://pdf-export/mcp-app.html",
          // Never sends `ui/initialize`, so the host times out and falls back to text.
          html: "<!DOCTYPE html><html><body></body></html>",
        },
      },
    ],
  }),
]
