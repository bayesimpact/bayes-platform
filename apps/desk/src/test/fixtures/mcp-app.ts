/**
 * A small MCP App for the stories and the tests, written against the protocol itself: it initializes, shows
 * the tool's result, reports its height, and proposes a message for the person to send.
 */
export const RELEASE_NOTES_APP_HTML = `<!doctype html>
<html><head><meta charset="utf-8"><style>
body{margin:0;font:14px system-ui,sans-serif;color:#1a1a1a}
.card{padding:12px 14px;display:flex;flex-direction:column;gap:8px}
h2{margin:0;font-size:14px}
ul{margin:0;padding-left:18px}
button{align-self:flex-start;border:1px solid #ddd;background:#fff;border-radius:8px;padding:6px 10px;cursor:pointer}
</style></head><body>
<div class="card"><h2>Release notes</h2><ul id="list"><li>Loading…</li></ul>
<button id="ask">Ask about the latest release</button></div>
<script>
var nextId = 1;
function send(message) { window.parent.postMessage(Object.assign({ jsonrpc: "2.0" }, message), "*"); }
function request(method, params) { send({ id: nextId++, method: method, params: params }); }
function reportHeight() {
  send({ method: "ui/notifications/size-changed", params: { height: document.documentElement.scrollHeight } });
}
window.addEventListener("message", function (event) {
  var message = event.data;
  if (!message || message.jsonrpc !== "2.0") return;
  if (message.id === 1 && message.result) {
    send({ method: "ui/notifications/initialized", params: {} });
    reportHeight();
  }
  if (message.method === "ui/notifications/tool-result") {
    var releases = (message.params.structuredContent || {}).releases || [];
    document.getElementById("list").innerHTML = releases
      .map(function (release) { return "<li>" + release + "</li>"; })
      .join("");
    reportHeight();
  }
  if (message.id !== undefined && message.method) send({ id: message.id, result: {} });
});
document.getElementById("ask").addEventListener("click", function () {
  request("ui/message", { role: "user", content: [{ type: "text", text: "What changed in 2.3?" }] });
});
request("ui/initialize", {
  appInfo: { name: "release-notes", version: "1.0.0" },
  appCapabilities: {},
  protocolVersion: "2026-01-26",
});
</script></body></html>`
