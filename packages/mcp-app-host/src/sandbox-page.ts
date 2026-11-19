/**
 * The page of the outer frame, and what a host and that page agree on. This file imports
 * nothing, so a build tool can load it alone to publish the page (`apps/web/vite.config.ts`).
 */

/** The envelope of every message between a host and an app's sandbox. */
export const ENVELOPE_TYPE = "mcp-app-host/rpc"
/** The ping the sandbox sends once its script runs, before the app loads. */
export const READY_TYPE = "mcp-app-host/ready"

/** Where a sandbox origin serves the page of the outer frame. */
export const MCP_APP_SANDBOX_PATH = "/mcp-app-sandbox.html"

/**
 * What both frames allow besides scripts. An inner frame inherits the restrictions of the outer
 * one, so an app's own `<a target="_blank">` or `window.open` only works when both carry these.
 * `allow-popups-to-escape-sandbox` makes the opened tab a normal page, and `allow-downloads` lets
 * that tab save a file: a browser judges a download by the frame that started the navigation.
 */
const POPUPS_AND_DOWNLOADS = "allow-popups allow-popups-to-escape-sandbox allow-downloads"

/**
 * The `sandbox` attribute of the frame that runs the app, and of the outer frame when it has no
 * origin of its own: scripts, popups and downloads, and no `allow-same-origin`, so the origin is
 * opaque. The app cannot reach its host, nor the page that relays its messages.
 */
export const MCP_APP_FRAME_SANDBOX = `allow-scripts ${POPUPS_AND_DOWNLOADS}`

/**
 * The `sandbox` attribute of the outer frame when a sandbox origin serves its page: the page
 * keeps that origin, which is never the host's, so each side can name the other's origin.
 */
export const MCP_APP_ORIGIN_FRAME_SANDBOX = `${MCP_APP_FRAME_SANDBOX} allow-same-origin`

/**
 * The page of the outer frame, which isolates an app from its host. It loads the app's HTML in
 * an inner frame through `srcdoc`, once the host sends
 * `ui/notifications/sandbox-resource-ready`, and relays the JSON-RPC messages both ways in an
 * envelope that names the sandbox. `srcdoc` makes the app parse as a normal document, Tailwind
 * v4's `@layer` CSS included, under the policy the host put at its top.
 *
 * The inner frame has no `allow-same-origin`, so the app gets an opaque origin of its own: it
 * cannot read or rewrite this page, which relays its messages and carries no policy, and storage
 * and cookies are closed to it. Its Content Security Policy would mean nothing otherwise: an app
 * that reaches this page runs what it wants from there.
 *
 * The page takes the origin of the first message its parent sends it as its host's: it then
 * listens to that origin alone, and names it when it relays what the app says. Any page can
 * frame this one and be its host. That page only gets a frame that runs the HTML it sends
 * itself, with an opaque origin: nothing here is worth reaching.
 *
 * It carries no Content Security Policy of its own, and must be served without one: a `srcdoc`
 * frame inherits its parent's policy, which would then apply to every app.
 *
 * `sandboxIdExpression` is the JavaScript that gives the sandbox's id.
 */
function sandboxPage(sandboxIdExpression: string): string {
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="robots" content="noindex"><style>
html,body{margin:0;padding:0;height:100%;overflow:hidden}
iframe{display:block;border:0;width:100%;height:100%}
</style></head><body><script>
(function () {
  var sandboxId = ${sandboxIdExpression};
  var hostOrigin = null;
  var app = null;
  window.addEventListener("message", function (event) {
    if (event.source === window.parent) {
      var data = event.data;
      if (!data || data.type !== "${ENVELOPE_TYPE}" || data.sandboxId !== sandboxId) return;
      // A sandboxed host has the origin "null", which no message can be addressed to.
      if (hostOrigin === null) hostOrigin = event.origin === "null" ? "*" : event.origin;
      else if (hostOrigin !== "*" && event.origin !== hostOrigin) return;
      var message = data.message;
      if (message && message.method === "ui/notifications/sandbox-resource-ready") {
        if (app) return;
        app = document.createElement("iframe");
        app.setAttribute("sandbox", "${MCP_APP_FRAME_SANDBOX}");
        app.srcdoc = message.params.html;
        document.body.appendChild(app);
        return;
      }
      if (app && app.contentWindow) app.contentWindow.postMessage(message, "*");
      return;
    }
    if (app && hostOrigin !== null && event.source === app.contentWindow) {
      window.parent.postMessage({ type: "${ENVELOPE_TYPE}", sandboxId: sandboxId, message: event.data }, hostOrigin);
    }
  });
  // The ping says nothing but the id its host chose, and the host is not known yet.
  window.parent.postMessage({ type: "${READY_TYPE}", sandboxId: sandboxId }, "*");
})();
</script></body></html>`
}

/** The page a host writes into the outer frame's `srcdoc`, when no sandbox origin serves it. */
export function inlineSandboxPage(sandboxId: string): string {
  return sandboxPage(JSON.stringify(sandboxId))
}

/**
 * The page a sandbox origin serves at `MCP_APP_SANDBOX_PATH`, the same for every app: it reads
 * its sandbox's id in the fragment of its URL.
 */
export function servedSandboxPage(): string {
  return sandboxPage("decodeURIComponent(window.location.hash.slice(1))")
}
