import { LATEST_PROTOCOL_VERSION } from "@modelcontextprotocol/ext-apps"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { McpAppView } from "@/common/features/agents/agent-sessions/shared/agent-session-messages/components/McpAppView"

/**
 * `SAMPLE_CARD_HTML` is a minimal stand-in MCP App guest written for this story only.
 * It is NOT the card served by the Go pdf-converter service (see `apps/pdf-converter/card.html`
 * for the real one) — it mimics just enough of the wire protocol (the `ui/initialize` handshake,
 * then rendering the tool result) to exercise `McpAppView` end to end in Storybook.
 * Clicking "Download" opens the signed URL in a new tab from inside the doubly-sandboxed
 * iframe, which only succeeds because of the `allow-popups allow-popups-to-escape-sandbox`
 * sandbox flags on both the outer and inner iframes.
 */
export const SAMPLE_CARD_HTML = `<!DOCTYPE html>
<html>
  <body style="font: 13px sans-serif; margin: 8px;">
    <div id="root">Loading…</div>
    <script>
      (function () {
        function send(message) {
          window.parent.postMessage(Object.assign({ jsonrpc: "2.0" }, message), "*")
        }
        function notifySize() {
          send({
            method: "ui/notifications/size-changed",
            params: { height: document.documentElement.getBoundingClientRect().height },
          })
        }
        // Same guard as the real card: only an absolute https: URL is ever
        // assigned as an href, so the sample never models a weaker pattern.
        function safeHttpsUrl(value) {
          if (typeof value !== "string" || value === "") return null
          try {
            return new URL(value).protocol === "https:" ? value : null
          } catch (parseError) {
            return null
          }
        }
        function render(structuredContent) {
          var root = document.getElementById("root")
          // expiresAt is an RFC 3339 string on the wire, like the real tool.
          var expiresAtMs = Date.parse(structuredContent.expiresAt)
          var expired = Number.isFinite(expiresAtMs) && expiresAtMs < Date.now()
          var downloadUrl = safeHttpsUrl(structuredContent.downloadUrl)
          root.innerHTML = ""
          var title = document.createElement("p")
          title.textContent = structuredContent.fileName || "document.pdf"
          root.appendChild(title)
          if (expired) {
            var expiredMessage = document.createElement("p")
            expiredMessage.textContent = "Link expired, ask the agent to export again"
            root.appendChild(expiredMessage)
          } else if (downloadUrl) {
            var link = document.createElement("a")
            link.href = downloadUrl
            link.target = "_blank"
            link.rel = "noopener noreferrer"
            link.textContent = "Download"
            root.appendChild(link)
          } else {
            var unavailable = document.createElement("p")
            unavailable.textContent = "Download link unavailable"
            root.appendChild(unavailable)
          }
          notifySize()
        }
        window.addEventListener("message", function (event) {
          if (event.source !== window.parent) return
          var message = event.data
          if (!message || message.jsonrpc !== "2.0") return
          if (message.method === "ui/notifications/tool-result") {
            render((message.params && message.params.structuredContent) || {})
            return
          }
          if (message.id === 1 && message.result) {
            send({ method: "ui/notifications/initialized" })
          }
        })
        send({
          id: 1,
          method: "ui/initialize",
          params: {
            appInfo: { name: "sample", version: "0" },
            appCapabilities: {},
            protocolVersion: "${LATEST_PROTOCOL_VERSION}",
          },
        })
        notifySize()
      })()
    </script>
  </body>
</html>`

const EXPIRY_WINDOW_MS = 15 * 60 * 1000

/**
 * Builds a tool result whose `expiresAt` is an RFC 3339 timestamp, matching the
 * real tool's output schema. Each story calls it from `render` so the countdown
 * starts from the full window every time, not from when the module was loaded.
 */
function buildToolResult(expiresInMs: number) {
  return {
    content: [{ type: "text", text: "ok" }],
    structuredContent: {
      fileName: "Quarterly notes.pdf",
      downloadUrl: "https://example.com/file.pdf",
      expiresAt: new Date(Date.now() + expiresInMs).toISOString(),
    },
  }
}

const meta = {
  title: "common/McpAppView",
  component: McpAppView,
  parameters: { layout: "padded" },
  args: {
    html: SAMPLE_CARD_HTML,
    toolInput: { markdown: "# Hello" },
    // Placeholder: every story overrides it in `render` with a fresh timestamp.
    toolResult: null,
  },
  decorators: [
    (Story) => (
      <div className="max-w-xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof McpAppView>

export default meta
type Story = StoryObj<typeof meta>

export const PdfExportCard: Story = {
  render: (args) => <McpAppView {...args} toolResult={buildToolResult(EXPIRY_WINDOW_MS)} />,
}

export const ExpiredCard: Story = {
  render: (args) => <McpAppView {...args} toolResult={buildToolResult(-60 * 1000)} />,
}
