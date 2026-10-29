import { LATEST_PROTOCOL_VERSION } from "@modelcontextprotocol/ext-apps"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { useState } from "react"
import { fn } from "storybook/test"
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

/**
 * A stand-in guest that proposes a message for the conversation (`ui/message`) when its button
 * is clicked, then shows whether the host took it.
 */
export const MESSAGE_CARD_HTML = `<!DOCTYPE html>
<html>
  <body style="font: 13px sans-serif; margin: 8px;">
    <button id="send" type="button">Send my notes</button>
    <p id="status"></p>
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
        window.addEventListener("message", function (event) {
          if (event.source !== window.parent) return
          var message = event.data
          if (!message || message.jsonrpc !== "2.0") return
          if (message.id === 1 && message.result) {
            send({ method: "ui/notifications/initialized" })
          }
          if (message.id === 2) {
            var accepted = message.result && !message.result.isError
            document.getElementById("status").textContent = accepted
              ? "Passed to the conversation"
              : "The host refused the message"
            notifySize()
          }
        })
        document.getElementById("send").addEventListener("click", function () {
          send({
            id: 2,
            method: "ui/message",
            params: {
              role: "user",
              content: [{ type: "text", text: "\`The first step\` Why this one first?" }],
            },
          })
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

/**
 * A stand-in guest that tests its own sandbox and lists what it found: whether it can reach the
 * frame around it, use storage, and call a server. The call is to `https://example.com`, so
 * the result depends on the domains the card declares.
 */
export const SANDBOX_PROBE_CARD_HTML = `<!DOCTYPE html>
<html>
  <body style="font: 13px sans-serif; margin: 8px;">
    <ul id="results"></ul>
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
        function report(label, outcome) {
          var item = document.createElement("li")
          item.textContent = label + ": " + outcome
          document.getElementById("results").appendChild(item)
          notifySize()
        }
        var blockedByPolicy = []
        document.addEventListener("securitypolicyviolation", function (event) {
          blockedByPolicy.push(event.effectiveDirective)
        })
        try {
          report("Read the frame around the card", window.parent.document ? "allowed" : "blocked")
        } catch (error) {
          report("Read the frame around the card", "blocked")
        }
        try {
          window.localStorage.getItem("probe")
          report("Use storage", "allowed")
        } catch (error) {
          report("Use storage", "blocked")
        }
        fetch("https://example.com", { mode: "no-cors" })
          .then(function () {
            report("Call https://example.com", "allowed")
          })
          .catch(function () {
            setTimeout(function () {
              var byPolicy = blockedByPolicy.indexOf("connect-src") !== -1
              report("Call https://example.com", byPolicy ? "blocked by the policy" : "failed")
            }, 0)
          })
        window.addEventListener("message", function (event) {
          if (event.source !== window.parent) return
          var message = event.data
          if (message && message.jsonrpc === "2.0" && message.id === 1 && message.result) {
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
  // The card HTML constants are exported for other stories, not stories themselves.
  excludeStories: /_HTML$/,
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

/** The card's message lands in the input below it, as in a conversation. */
export const ProposesMessage: Story = {
  args: { html: MESSAGE_CARD_HTML, onMessage: fn() },
  render: (args) => <CardAboveInput {...args} />,
}

function CardAboveInput(props: React.ComponentProps<typeof McpAppView>) {
  const [draft, setDraft] = useState("")
  return (
    <div className="flex flex-col gap-2">
      <McpAppView
        {...props}
        toolResult={buildToolResult(EXPIRY_WINDOW_MS)}
        onMessage={(text) => {
          props.onMessage?.(text)
          setDraft(text)
        }}
      />
      <textarea
        aria-label="Chat input"
        className="rounded-md border p-2 text-sm"
        readOnly
        value={draft}
      />
    </div>
  )
}

/** A card that declares no domain: it reaches neither the page around it nor any server. */
export const SandboxStrictPolicy: Story = {
  args: { html: SANDBOX_PROBE_CARD_HTML },
  render: (args) => <McpAppView {...args} toolResult={buildToolResult(EXPIRY_WINDOW_MS)} />,
}

/** A card that declares `https://example.com`: it may call that server, and only that one. */
export const SandboxDeclaredDomain: Story = {
  args: { html: SANDBOX_PROBE_CARD_HTML, csp: { connectDomains: ["https://example.com"] } },
  render: (args) => <McpAppView {...args} toolResult={buildToolResult(EXPIRY_WINDOW_MS)} />,
}
