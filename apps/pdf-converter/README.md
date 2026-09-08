# pdf-converter

Dedicated service that rasterizes PDFs into PNG page images for image-only LLMs
(Gemma, MedGemma), and exposes an MCP tool that exports markdown as a downloadable
PDF. Page rasterizing happens in WebAssembly (`go-pdfium` + `wazero`) and is
GCS-native: PDFs are fetched from GCS, rendered in isolation, and pages are streamed
directly to GCS. Markdown-to-PDF rendering is pure Go (`internal/mdpdf`). No local
storage or subprocess management needed.

## Endpoints

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/render-document` | Body: JSON with source PDF path and output prefix. Returns `{ "pageCount": <number> }` with pages uploaded as `{outputPrefix}page-{n}.png`. |
| `POST` | `/mcp` | Stateless MCP streamable-HTTP endpoint; see [MCP endpoint](#mcp-endpoint) below. |
| `GET` | `/healthz` | Liveness probe, no auth. |

`POST /render-document` requires a JSON body with:

- `sourceObject` (string, required) — relative GCS object path to the source PDF (e.g., `org/project/document.pdf`).
- `outputPrefix` (string, required) — relative GCS object path prefix where pages are saved; must end with `/` (e.g., `org/project/output/`).
- `maxPages` (integer, 1–100, required) — reject PDFs with more pages (HTTP 422).
- `maxPixelsPerPage` (integer, 1–16000000, required) — clamp each page's rendered bitmap height and width.

All paths must be relative (no leading `/`) and free of `..` traversal.

Response on success: `{ "pageCount": <int> }` (HTTP 200).

Errors are:
- **400** — invalid PDF, malformed JSON body, invalid parameters, or invalid object paths.
- **404** — source PDF not found in GCS.
- **413** — source PDF exceeds `PDF_CONVERTER_MAX_PDF_BYTES`.
- **422** — PDF has more pages than `maxPages`; nothing is rendered and the body includes the document's `pageCount`.
- **500** — server error (e.g., failed to upload page to GCS).
- **504** — rendering exceeded `PDF_CONVERTER_RENDER_TIMEOUT_MS` (or the caller disconnected); the pdfium instance is killed and re-created, so a hostile PDF cannot wedge the service.

## MCP endpoint

`POST /mcp` is a stateless [MCP](https://modelcontextprotocol.io) streamable-HTTP server
that lets an agent turn markdown into a downloadable PDF. `GET` and `DELETE /mcp` return
`405 Method Not Allowed` with `Allow: POST` — there is no session to resume, every call
is self-contained. The endpoint has no auth of its own: it is protected the same way as
the rest of the service, by Cloud Run invoker IAM.

### Tool: `convert_markdown_to_pdf`

Input:

```json
{
  "markdown": "# Report\n\nBody text.",
  "fileName": "Quarterly report",
  "title": "Q3 report"
}
```

- `markdown` (required) — GitHub Flavored Markdown, up to `PDF_EXPORT_MAX_MARKDOWN_BYTES`.
- `fileName` (optional) — characters outside letters, digits, dot, underscore, space and
  dash are stripped and `.pdf` is appended; defaults to `document.pdf`. Letters and
  digits are Unicode, so `Résumé.pdf` or `報告.pdf` survive intact (GCS object names are
  UTF-8), while path separators, quotes and control characters never do. The signed
  URL's `Content-Disposition` carries both an ASCII fallback (`filename=`) and the real
  UTF-8 name (RFC 5987 `filename*=`).
- `title` (optional) — PDF metadata and header title; defaults to the first level-1
  heading, then to the file name.

Output on success:

```json
{
  "downloadUrl": "https://storage.googleapis.com/...",
  "fileName": "Quarterly report.pdf",
  "pageCount": 3,
  "sizeBytes": 48213,
  "expiresAt": "2026-09-07T12:15:00Z"
}
```

Failures (empty markdown, markdown over the byte cap, more than 200 pages, or a storage
error) come back as a normal tool result with `isError: true` and a plain-text
explanation, never as a transport-level error. The model-facing text never contains the
signed URL — it names the file, the page count and the expiry, and tells the model to
point the user at the download card instead of pasting the link.

The tool declares `_meta.ui.resourceUri: "ui://pdf-export/download-card"`, which is how
a host discovers the MCP App resource below.

### Resource: `ui://pdf-export/download-card`

An [MCP App](https://modelcontextprotocol.io) (`text/html;profile=mcp-app`) embedded
from `card.html`. It runs inside a sandboxed iframe, talks JSON-RPC 2.0 over
`window.postMessage`, and reacts to `ui/notifications/tool-input` and
`ui/notifications/tool-result` by showing the file name, page count, size and a live
"link expires in mm:ss" countdown next to a plain
`<a target="_blank" rel="noopener noreferrer">` download button. That anchor is the
only download path: the card never sends `ui/open-link`, so the user's click always
navigates natively. The host must sandbox the iframe with at least
`allow-popups allow-popups-to-escape-sandbox allow-downloads`: without the first two the
link cannot open a new tab, and without `allow-downloads` browsers open the tab but
block the download because it was started from a sandboxed frame. The card follows
`hostContext.theme` (light by default) rather than the OS colour scheme.

### The `tmp/pdf-exports/` prefix and the TTL contract

Every export is written once to `{PDF_EXPORT_TMP_PREFIX}{uuid}/{fileName}` and this
service never deletes it — `SignedURL` only hands out a link that stops working after
`PDF_EXPORT_TTL_MINUTES`, the object itself stays in GCS. The upload stamps that same
expiry on the object as its GCS `customTime`, so the object carries its own lifetime.
Deleting it is the API's job: a worker sweeps `PDF_EXPORT_TMP_PREFIX` and removes
objects whose `customTime` is in the past, without needing its own copy of the TTL.
If that sweep is ever disabled, exported PDFs accumulate in the bucket.

### Signing requirements

Minting a signed URL needs a credential that can sign, not just a bearer token:

- Locally, `GOOGLE_APPLICATION_CREDENTIALS` must point at a service-account key file.
- On Cloud Run, the service's own service account needs
  `roles/iam.serviceAccountTokenCreator` on itself, and the project needs the IAM
  Credentials API enabled — the runtime then signs remotely via `signBlob` instead of a
  local private key.
- Plain user Application Default Credentials (e.g. from `gcloud auth
  application-default login`) cannot sign; `SignedURL` fails with a credential error.

### Supported markdown and known limits

Rendering is pure Go (`internal/mdpdf`, no headless browser, no network access):
CommonMark plus GitHub tables, task lists and strikethrough, set in embedded DejaVu
Sans and DejaVu Sans Mono (Bitstream Vera licence, see
`internal/mdpdf/fonts/LICENSE`). Known limits:

- Images are never fetched: `![alt](url)` renders as italic `[alt](url)` text instead
  of an embedded picture.
- Raw HTML, inline and block, is dropped rather than rendered as literal markup.
- DejaVu covers Latin (with accents), Greek and Cyrillic, but has no CJK glyphs, so CJK
  text is silently missing from the output.
- Documents over 200 pages are rejected before anything is uploaded.

### MCP-specific environment variables

- `PDF_EXPORT_TTL_MINUTES` (default `15`, max `10080`) — how long a signed download link
  stays valid; capped at seven days because that is GCS V4 signing's own limit — a
  higher value starts the service and then fails every export once uploaded. Only this
  service needs it: the expiry is stamped on each object, and the API workers' copy of
  the variable is a fallback for objects written before that stamp existed.
- `PDF_EXPORT_MAX_MARKDOWN_BYTES` (default `1048576`, 1 MiB) — markdown input size cap.
- `PDF_EXPORT_TMP_PREFIX` (default `tmp/pdf-exports/`) — GCS prefix exports are written
  under; must be a relative object path ending with `/`.

### Smoke test

```bash
curl -sS -X POST "http://localhost:3002/mcp" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

## Authentication

The app itself has no auth layer. In production the Cloud Run service runs
with invoker IAM enabled: only identities holding `roles/run.invoker` (the
platform's api service account) can reach the container, and callers must
send a Google ID token minted for the service URL — the main API does this
when `PDF_CONVERTER_AUTH=google-iam` is set (Terraform sets it). Locally the
service is only bound on the developer's machine.

## Environment variables

- `GCS_STORAGE_BUCKET_NAME` (required) — GCS bucket for source PDFs and rendered pages.
- `PORT` (default `3002`) — listen port.
- `PDF_CONVERTER_MAX_PDF_BYTES` (default `52428800`, 50MB) — source PDF size limit.
- `PDF_CONVERTER_RENDER_TIMEOUT_MS` (default `60000`, 60s) — hard per-request deadline for rendering work; must stay below the API client's 120s request timeout.
- `PDF_EXPORT_TTL_MINUTES` (default `15`, max `10080`) — how long a signed PDF export download link stays valid; see [MCP endpoint](#mcp-endpoint).
- `PDF_EXPORT_MAX_MARKDOWN_BYTES` (default `1048576`, 1 MiB) — markdown input size cap for the PDF export tool.
- `PDF_EXPORT_TMP_PREFIX` (default `tmp/pdf-exports/`) — GCS prefix PDF exports are written under.

## Local development

```bash
# Start the converter (requires GOOGLE_APPLICATION_CREDENTIALS pointing to a service account)
PORT=3002 \
  GCS_STORAGE_BUCKET_NAME=<dev-bucket> \
  GOOGLE_APPLICATION_CREDENTIALS=<path-to-service-account-json> \
  go run .

# Smoke-test with a source object and a dev bucket:
curl -sS -X POST -H "Content-Type: application/json" \
  -d '{"sourceObject":"test.pdf","outputPrefix":"output/","maxPages":20,"maxPixelsPerPage":4000000}' \
  "http://localhost:3002/render-document"
```

To make the main API use it locally, set in `apps/api/.env`:

```
PDF_CONVERTER_URL=http://localhost:3002
```

(Leave `PDF_CONVERTER_AUTH` unset locally — no auth header is sent.)

## Tests

```bash
go test ./...
go vet ./...
```

## Deployment

This service is intentionally **not** part of the automatic deploy pipeline
(it changes rarely; the platform deploy does not rebuild it).

Deployment is a manual **"Deploy PDF Converter"** GitHub action in the infra
repo (**to be created** — workflow_dispatch: pick the app-repo ref and the GCP
project), run once per project.

Equivalent local command, once available, if you have the GCP credentials:

```bash
cd infra/platform
make deploy-pdf-converter REGION=eu PROJECT=connect version=<app-repo-short-sha>
```

(`deploy-pdf-converter` is **not yet a Makefile target** — it is planned as
part of the same infra-repo follow-up as the GitHub action above.)
