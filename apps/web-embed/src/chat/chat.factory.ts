import type { AgentSessionMessageDto } from "@caseai-connect/api-contracts"

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
    createdAt: new Date().toISOString(),
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
    createdAt: new Date().toISOString(),
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
