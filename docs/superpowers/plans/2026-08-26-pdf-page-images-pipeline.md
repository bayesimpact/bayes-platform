# PDF Page Images Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Superseded in part (2026-08-28):** after execution, the public 302-redirect
> page endpoints (`getAttachmentPdfPageImage`, `getPdfPageImage`, Task 8) were
> removed — `PdfPagesService.getImageUrls` now hands the model fresh V4-signed
> GCS URLs directly, `PdfConverterClient.renderDocument` was renamed
> `generatePdfPageImages`, and the `API_PUBLIC_BASE_URL` env var is gone with
> them. The spec (link below) reflects the final architecture; the tasks below
> are kept as the historical execution record.

**Goal:** Replace the byte-pumping PDF→image conversion for Gemma/MedGemma with a GCS-native Go converter service, cached page counts, and stable 302-redirect page URLs the LLM serving stack fetches itself.

**Architecture:** A new Go Cloud Run service (`apps/pdf-converter`, go-pdfium WebAssembly backend) reads PDFs from GCS, writes one PNG per page back to GCS, and returns only a page count. The API renders eagerly at LLM-request build time (cached in a new `pdf_page_count` column), then sends the model stable public capability URLs that 302-redirect to fresh V4-signed GCS URLs. The old in-API byte pipeline (`convertPdfPartsToImageParts` + `apps/pdf-renderer` HTTP calls) is deleted.

**Tech Stack:** Go 1.24, `github.com/klippa-app/go-pdfium` (WebAssembly/wazero backend), `cloud.google.com/go/storage`; NestJS + TypeORM on the API side; AI SDK v3 URL passthrough (`supportedUrls`).

**Spec:** `docs/superpowers/plans/2026-08-26-pdf-page-images-spec.md`

## Global Constraints

- Work on a dedicated branch (e.g. `322-pdf-converter-page-images`), created via the superpowers:using-git-worktrees skill at execution start. Remember worktree rules from root CLAUDE.md: `npm ci` only (never `npm install`), shared Postgres/Redis, don't start duplicate workers.
- NEVER use single-letter variables in loops/callbacks (root CLAUDE.md) — applies to Go code too.
- `npm run biome:check` is root-only and rewrites files; run it from the repo root.
- Single API spec files run with: `cd apps/api && node --experimental-vm-modules node_modules/.bin/jest --colors --runInBand --forceExit <path>` (plain `npx jest` fails on this machine).
- NestJS DI needs regular imports (with `// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI`), never `import type`, for injected classes.
- Migration workflow: entities first, `npm run migration:run`, then `npm run migration:generate` — never hand-write migrations (apps/api/CLAUDE.md).
- Limits stay: `maxPages = 20`, `maxPixelsPerPage = 4_000_000`, render scale 2.
- Derived page objects: `{org}/{proj}/derived/{sourceBasenameWithoutExt}/page-{n}.png`, pageNumber 1-based.
- New env vars: `PDF_CONVERTER_URL`, `PDF_CONVERTER_AUTH` (`google-iam` in prod), `API_PUBLIC_BASE_URL` (API), `GCS_STORAGE_BUCKET_NAME`, `PDF_CONVERTER_MAX_PDF_BYTES`, `PORT` (converter).
- This machine has no Go toolchain (`go version` fails) and is linux/arm64. Task 1 installs Go into `$HOME` (no sudo). Docker fallback: `docker run --rm -v "$PWD":/src -w /src/apps/pdf-converter golang:1.24 go test ./...`.
- Neutral sample data in tests/fixtures (root CLAUDE.md) — generic file names like `report.pdf`, no domain-specific content.

---

### Task 1: Go converter — rendering core

**Files:**
- Create: `apps/pdf-converter/go.mod`
- Create: `apps/pdf-converter/internal/render/render.go`
- Create: `apps/pdf-converter/internal/render/pdftest/pdftest.go`
- Test: `apps/pdf-converter/internal/render/render_test.go`

**Interfaces:**
- Consumes: nothing (first task).
- Produces: `render.NewRenderer() (*render.Renderer, error)`; `(*Renderer).RenderPages(pdfBytes []byte, maxPages int, maxPixelsPerPage int, emit func(pageNumber int, pngBytes []byte) error) (pageCount int, err error)`; sentinel errors `render.ErrTooManyPages`, `render.ErrInvalidPdf`; test helper `pdftest.BuildPdfWithPages(pageCount int, pageSizePoints int) []byte`.

- [ ] **Step 1: Install Go if missing**

```bash
go version || (
  curl -fsSL https://go.dev/dl/go1.24.5.linux-arm64.tar.gz -o /tmp/go.tgz &&
  mkdir -p "$HOME/.local" && tar -C "$HOME/.local" -xzf /tmp/go.tgz &&
  export PATH="$HOME/.local/go/bin:$PATH" && go version
)
```
(Adjust the patch version to the latest 1.24.x if the URL 404s; keep the `export PATH` for every later Go command.)

- [ ] **Step 2: Init the module and fetch deps**

```bash
mkdir -p apps/pdf-converter/internal/render/pdftest
cd apps/pdf-converter
go mod init github.com/bayesimpact/bayes-platform/apps/pdf-converter
go get github.com/klippa-app/go-pdfium@latest
```

- [ ] **Step 3: Write the fixture builder** — a direct Go port of `buildPdfWithPages` from `apps/pdf-renderer/src/render/render.spec.ts:10-34` (minimal valid PDF with N empty pages):

```go
// Package pdftest builds minimal valid PDFs for converter tests.
package pdftest

import (
	"fmt"
	"strings"
)

// BuildPdfWithPages returns a minimal but valid PDF containing pageCount empty
// pages of pageSizePoints x pageSizePoints.
func BuildPdfWithPages(pageCount int, pageSizePoints int) []byte {
	kids := make([]string, pageCount)
	for pageIndex := range kids {
		kids[pageIndex] = fmt.Sprintf("%d 0 R", pageIndex+3)
	}
	objects := []string{
		"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
		fmt.Sprintf("2 0 obj\n<< /Type /Pages /Kids [%s] /Count %d >>\nendobj\n",
			strings.Join(kids, " "), pageCount),
	}
	for pageIndex := 0; pageIndex < pageCount; pageIndex++ {
		objects = append(objects, fmt.Sprintf(
			"%d 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 %d %d] >>\nendobj\n",
			pageIndex+3, pageSizePoints, pageSizePoints))
	}
	body := "%PDF-1.4\n"
	offsets := make([]int, 0, len(objects))
	for _, object := range objects {
		offsets = append(offsets, len(body))
		body += object
	}
	xrefOffset := len(body)
	xref := fmt.Sprintf("xref\n0 %d\n0000000000 65535 f \n", len(objects)+1)
	for _, offset := range offsets {
		xref += fmt.Sprintf("%010d 00000 n \n", offset)
	}
	trailer := fmt.Sprintf(
		"trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF",
		len(objects)+1, xrefOffset)
	return []byte(body + xref + trailer)
}
```

- [ ] **Step 4: Write the failing tests** (`render_test.go`):

```go
package render

import (
	"bytes"
	"image/png"
	"testing"

	"github.com/bayesimpact/bayes-platform/apps/pdf-converter/internal/render/pdftest"
)

func newTestRenderer(t *testing.T) *Renderer {
	t.Helper()
	renderer, err := NewRenderer()
	if err != nil {
		t.Fatalf("NewRenderer: %v", err)
	}
	return renderer
}

func collectPages(t *testing.T, renderer *Renderer, pdfBytes []byte, maxPages, maxPixels int) (int, [][]byte) {
	t.Helper()
	rendered := [][]byte{}
	pageCount, err := renderer.RenderPages(pdfBytes, maxPages, maxPixels,
		func(pageNumber int, pngBytes []byte) error {
			rendered = append(rendered, pngBytes)
			return nil
		})
	if err != nil {
		t.Fatalf("RenderPages: %v", err)
	}
	return pageCount, rendered
}

func TestRendersEachPageAsPng(t *testing.T) {
	renderer := newTestRenderer(t)
	pageCount, rendered := collectPages(t, renderer, pdftest.BuildPdfWithPages(2, 200), 20, 4_000_000)
	if pageCount != 2 || len(rendered) != 2 {
		t.Fatalf("expected 2 pages, got pageCount=%d rendered=%d", pageCount, len(rendered))
	}
	image, err := png.Decode(bytes.NewReader(rendered[0]))
	if err != nil {
		t.Fatalf("first page is not a png: %v", err)
	}
	// 200pt page at scale 2 -> 400px.
	if image.Bounds().Dx() != 400 || image.Bounds().Dy() != 400 {
		t.Fatalf("expected 400x400, got %v", image.Bounds())
	}
}

func TestCapsPixelsPerPage(t *testing.T) {
	renderer := newTestRenderer(t)
	// 4000pt at scale 2 would be 8000x8000 = 64M px; the 4M cap must shrink it.
	_, rendered := collectPages(t, renderer, pdftest.BuildPdfWithPages(1, 4000), 20, 4_000_000)
	image, err := png.Decode(bytes.NewReader(rendered[0]))
	if err != nil {
		t.Fatalf("page is not a png: %v", err)
	}
	pixels := image.Bounds().Dx() * image.Bounds().Dy()
	if pixels > 4_000_000 {
		t.Fatalf("expected <= 4M pixels, got %d (%v)", pixels, image.Bounds())
	}
}

func TestRejectsTooManyPages(t *testing.T) {
	renderer := newTestRenderer(t)
	_, err := renderer.RenderPages(pdftest.BuildPdfWithPages(3, 200), 2, 4_000_000,
		func(pageNumber int, pngBytes []byte) error { return nil })
	if !errorsIs(err, ErrTooManyPages) {
		t.Fatalf("expected ErrTooManyPages, got %v", err)
	}
}

func TestRejectsInvalidPdf(t *testing.T) {
	renderer := newTestRenderer(t)
	_, err := renderer.RenderPages([]byte("not a pdf at all"), 20, 4_000_000,
		func(pageNumber int, pngBytes []byte) error { return nil })
	if !errorsIs(err, ErrInvalidPdf) {
		t.Fatalf("expected ErrInvalidPdf, got %v", err)
	}
}
```
(use `errors.Is` directly — the `errorsIs` alias above is shorthand in this plan, write `errors.Is(err, ...)` with the `errors` import.)

- [ ] **Step 5: Run tests to verify they fail**

Run: `cd apps/pdf-converter && go test ./internal/render/`
Expected: FAIL — `NewRenderer` undefined.

- [ ] **Step 6: Implement `render.go`**

```go
// Package render rasterizes PDF pages to PNG using go-pdfium's WebAssembly
// backend: no cgo, and a malicious PDF is confined to the wazero sandbox.
package render

import (
	"bytes"
	"errors"
	"fmt"
	"image/png"
	"math"
	"time"

	"github.com/klippa-app/go-pdfium"
	"github.com/klippa-app/go-pdfium/requests"
	"github.com/klippa-app/go-pdfium/webassembly"
)

var (
	ErrTooManyPages = errors.New("page limit exceeded")
	ErrInvalidPdf   = errors.New("invalid pdf")
)

// PDF points are 1/72"; scale 2 renders ~144dpi, matching the previous
// pdf-renderer so extracted text stays legible.
const renderScale = 2.0

type Renderer struct {
	pool pdfium.Pool
}

func NewRenderer() (*Renderer, error) {
	pool, err := webassembly.Init(webassembly.Config{
		MinIdle:  0,
		MaxIdle:  1,
		MaxTotal: 4,
	})
	if err != nil {
		return nil, fmt.Errorf("init pdfium webassembly pool: %w", err)
	}
	return &Renderer{pool: pool}, nil
}

// RenderPages rasterizes every page as PNG and hands each to emit with a
// 1-based page number. Returns the page count.
func (renderer *Renderer) RenderPages(
	pdfBytes []byte,
	maxPages int,
	maxPixelsPerPage int,
	emit func(pageNumber int, pngBytes []byte) error,
) (int, error) {
	instance, err := renderer.pool.GetInstance(30 * time.Second)
	if err != nil {
		return 0, fmt.Errorf("get pdfium instance: %w", err)
	}
	defer instance.Close()

	document, err := instance.OpenDocument(&requests.OpenDocument{File: &pdfBytes})
	if err != nil {
		return 0, fmt.Errorf("%w: %v", ErrInvalidPdf, err)
	}
	defer instance.FPDF_CloseDocument(&requests.FPDF_CloseDocument{Document: document.Document})

	pageCountResponse, err := instance.FPDF_GetPageCount(&requests.FPDF_GetPageCount{
		Document: document.Document,
	})
	if err != nil {
		return 0, fmt.Errorf("%w: %v", ErrInvalidPdf, err)
	}
	pageCount := pageCountResponse.PageCount
	if pageCount > maxPages {
		return 0, fmt.Errorf("%w: pdf has %d pages, max is %d", ErrTooManyPages, pageCount, maxPages)
	}

	for pageIndex := 0; pageIndex < pageCount; pageIndex++ {
		page := requests.Page{ByIndex: &requests.PageByIndex{
			Document: document.Document,
			Index:    pageIndex,
		}}
		size, err := instance.GetPageSize(&requests.GetPageSize{Page: page})
		if err != nil {
			return 0, fmt.Errorf("get size of page %d: %w", pageIndex+1, err)
		}
		scale := renderScale
		if size.Width*size.Height*scale*scale > float64(maxPixelsPerPage) {
			scale = math.Sqrt(float64(maxPixelsPerPage) / (size.Width * size.Height))
		}
		rendered, err := instance.RenderPageInPixels(&requests.RenderPageInPixels{
			Page:   page,
			Width:  int(size.Width * scale),
			Height: int(size.Height * scale),
		})
		if err != nil {
			return 0, fmt.Errorf("render page %d: %w", pageIndex+1, err)
		}
		var pngBuffer bytes.Buffer
		// Encode before Cleanup: in WebAssembly mode the pixel buffer is only
		// valid until Cleanup is called.
		if err := png.Encode(&pngBuffer, rendered.Result.Image); err != nil {
			rendered.Cleanup()
			return 0, fmt.Errorf("encode page %d: %w", pageIndex+1, err)
		}
		rendered.Cleanup()
		if err := emit(pageIndex+1, pngBuffer.Bytes()); err != nil {
			return 0, err
		}
	}
	return pageCount, nil
}
```
Notes for the implementer: exact response field names (`rendered.Result.Image` vs `RenderedImage`, `Cleanup()` location) come from the installed go-pdfium version — let the compiler guide you; the requirements are (a) encode before releasing the wasm buffer, (b) prefer the non-deprecated image field. Also check whether `webassembly.Config` exposes an `FSConfig` field in the installed version; if it does, set it to an empty wazero FS config so the sandbox mounts no host filesystem (untrusted input hardening) — if the field doesn't exist in this version, skip it and note that in the commit message.

- [ ] **Step 7: Run tests to verify they pass**

Run: `cd apps/pdf-converter && go mod tidy && go vet ./... && go test ./internal/render/`
Expected: PASS (first run downloads the embedded pdfium wasm module; allow a minute).

- [ ] **Step 8: Commit**

```bash
git add apps/pdf-converter
git commit -m "feat(pdf-converter): go-pdfium wasm rendering core"
```

---

### Task 2: Go converter — GCS store, HTTP server, Dockerfile

**Files:**
- Create: `apps/pdf-converter/store.go`
- Create: `apps/pdf-converter/server.go`
- Create: `apps/pdf-converter/main.go`
- Create: `apps/pdf-converter/Dockerfile`
- Test: `apps/pdf-converter/server_test.go`

**Interfaces:**
- Consumes: `render.NewRenderer`, `(*Renderer).RenderPages`, `render.ErrTooManyPages`, `render.ErrInvalidPdf`, `pdftest.BuildPdfWithPages` (Task 1).
- Produces: HTTP contract `POST /render-document` with JSON body `{"sourceObject": string, "outputPrefix": string, "maxPages": int, "maxPixelsPerPage": int}` → `200 {"pageCount": int}`; errors `{"message": string}` with 400/404/413/422; `GET /healthz` → `{"status":"ok"}`. Page objects written as `{outputPrefix}page-{n}.png`, content type `image/png`. Internal: `objectStore` interface `{ Size(ctx, object) (int64, error); Download(ctx, object) ([]byte, error); Upload(ctx, object, contentType string, data []byte) error }`; `newServer(store objectStore, renderer *render.Renderer, maxSourceBytes int64) http.Handler`.

- [ ] **Step 1: Write the failing server tests** (`server_test.go`, package `main`):

```go
package main

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/bayesimpact/bayes-platform/apps/pdf-converter/internal/render"
	"github.com/bayesimpact/bayes-platform/apps/pdf-converter/internal/render/pdftest"
)

type fakeStore struct {
	objects map[string][]byte
}

func (store *fakeStore) Size(ctx context.Context, object string) (int64, error) {
	data, found := store.objects[object]
	if !found {
		return 0, errObjectNotFound
	}
	return int64(len(data)), nil
}

func (store *fakeStore) Download(ctx context.Context, object string) ([]byte, error) {
	data, found := store.objects[object]
	if !found {
		return nil, errObjectNotFound
	}
	return data, nil
}

func (store *fakeStore) Upload(ctx context.Context, object string, contentType string, data []byte) error {
	store.objects[object] = data
	return nil
}

func newTestServer(t *testing.T, store *fakeStore) http.Handler {
	t.Helper()
	renderer, err := render.NewRenderer()
	if err != nil {
		t.Fatalf("NewRenderer: %v", err)
	}
	return newServer(store, renderer, 50*1024*1024)
}

func postRender(handler http.Handler, body string) *httptest.ResponseRecorder {
	request := httptest.NewRequest(http.MethodPost, "/render-document", strings.NewReader(body))
	request.Header.Set("Content-Type", "application/json")
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, request)
	return recorder
}

func TestRenderDocumentHappyPath(t *testing.T) {
	store := &fakeStore{objects: map[string][]byte{
		"org1/proj1/doc1.pdf": pdftest.BuildPdfWithPages(2, 200),
	}}
	handler := newTestServer(t, store)
	response := postRender(handler,
		`{"sourceObject":"org1/proj1/doc1.pdf","outputPrefix":"org1/proj1/derived/doc1/","maxPages":20,"maxPixelsPerPage":4000000}`)
	if response.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", response.Code, response.Body.String())
	}
	var parsed struct {
		PageCount int `json:"pageCount"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &parsed); err != nil || parsed.PageCount != 2 {
		t.Fatalf("expected pageCount 2, got %s", response.Body.String())
	}
	pageOne := store.objects["org1/proj1/derived/doc1/page-1.png"]
	if !bytes.HasPrefix(pageOne, []byte{0x89, 0x50, 0x4e, 0x47}) {
		t.Fatalf("page-1.png missing or not a png")
	}
	if _, found := store.objects["org1/proj1/derived/doc1/page-2.png"]; !found {
		t.Fatalf("page-2.png missing")
	}
}

func TestRenderDocumentPageLimit(t *testing.T) {
	store := &fakeStore{objects: map[string][]byte{
		"org1/proj1/doc1.pdf": pdftest.BuildPdfWithPages(3, 200),
	}}
	response := postRender(newTestServer(t, store),
		`{"sourceObject":"org1/proj1/doc1.pdf","outputPrefix":"org1/proj1/derived/doc1/","maxPages":2,"maxPixelsPerPage":4000000}`)
	if response.Code != http.StatusUnprocessableEntity {
		t.Fatalf("expected 422, got %d", response.Code)
	}
}

func TestRenderDocumentSourceMissing(t *testing.T) {
	response := postRender(newTestServer(t, &fakeStore{objects: map[string][]byte{}}),
		`{"sourceObject":"org1/proj1/nope.pdf","outputPrefix":"org1/proj1/derived/nope/","maxPages":20,"maxPixelsPerPage":4000000}`)
	if response.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", response.Code)
	}
}

func TestRenderDocumentInvalidPdf(t *testing.T) {
	store := &fakeStore{objects: map[string][]byte{"org1/proj1/doc1.pdf": []byte("not a pdf")}}
	response := postRender(newTestServer(t, store),
		`{"sourceObject":"org1/proj1/doc1.pdf","outputPrefix":"org1/proj1/derived/doc1/","maxPages":20,"maxPixelsPerPage":4000000}`)
	if response.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", response.Code)
	}
}

func TestRenderDocumentValidation(t *testing.T) {
	handler := newTestServer(t, &fakeStore{objects: map[string][]byte{}})
	for _, body := range []string{
		`{`,
		`{"sourceObject":"","outputPrefix":"a/","maxPages":20,"maxPixelsPerPage":4000000}`,
		`{"sourceObject":"../etc/x.pdf","outputPrefix":"a/","maxPages":20,"maxPixelsPerPage":4000000}`,
		`{"sourceObject":"a/b.pdf","outputPrefix":"a/derived/b","maxPages":20,"maxPixelsPerPage":4000000}`,
	} {
		if response := postRender(handler, body); response.Code != http.StatusBadRequest {
			t.Fatalf("expected 400 for %q, got %d", body, response.Code)
		}
	}
}

func TestHealthz(t *testing.T) {
	request := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	recorder := httptest.NewRecorder()
	newTestServer(t, &fakeStore{objects: map[string][]byte{}}).ServeHTTP(recorder, request)
	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", recorder.Code)
	}
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/pdf-converter && go test ./...`
Expected: FAIL — `newServer`, `errObjectNotFound` undefined.

- [ ] **Step 3: Implement `store.go`**

```go
package main

import (
	"context"
	"errors"
	"fmt"
	"io"

	"cloud.google.com/go/storage"
)

// errObjectNotFound normalizes "missing object" across the real GCS store and
// test fakes so the handler can map it to a 404.
var errObjectNotFound = errors.New("object not found")

type objectStore interface {
	Size(ctx context.Context, object string) (int64, error)
	Download(ctx context.Context, object string) ([]byte, error)
	Upload(ctx context.Context, object string, contentType string, data []byte) error
}

type gcsStore struct {
	bucket *storage.BucketHandle
}

func (store *gcsStore) Size(ctx context.Context, object string) (int64, error) {
	attrs, err := store.bucket.Object(object).Attrs(ctx)
	if errors.Is(err, storage.ErrObjectNotExist) {
		return 0, errObjectNotFound
	}
	if err != nil {
		return 0, fmt.Errorf("stat %s: %w", object, err)
	}
	return attrs.Size, nil
}

func (store *gcsStore) Download(ctx context.Context, object string) ([]byte, error) {
	reader, err := store.bucket.Object(object).NewReader(ctx)
	if errors.Is(err, storage.ErrObjectNotExist) {
		return nil, errObjectNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("open %s: %w", object, err)
	}
	defer reader.Close()
	data, err := io.ReadAll(reader)
	if err != nil {
		return nil, fmt.Errorf("read %s: %w", object, err)
	}
	return data, nil
}

func (store *gcsStore) Upload(ctx context.Context, object string, contentType string, data []byte) error {
	writer := store.bucket.Object(object).NewWriter(ctx)
	writer.ContentType = contentType
	if _, err := writer.Write(data); err != nil {
		writer.Close()
		return fmt.Errorf("write %s: %w", object, err)
	}
	if err := writer.Close(); err != nil {
		return fmt.Errorf("close %s: %w", object, err)
	}
	return nil
}
```
Run `go get cloud.google.com/go/storage@latest && go mod tidy` for the dep.

- [ ] **Step 4: Implement `server.go`**

```go
package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"strings"

	"github.com/bayesimpact/bayes-platform/apps/pdf-converter/internal/render"
)

type renderDocumentRequest struct {
	SourceObject     string `json:"sourceObject"`
	OutputPrefix     string `json:"outputPrefix"`
	MaxPages         int    `json:"maxPages"`
	MaxPixelsPerPage int    `json:"maxPixelsPerPage"`
}

func writeJSON(response http.ResponseWriter, status int, payload any) {
	response.Header().Set("Content-Type", "application/json")
	response.WriteHeader(status)
	json.NewEncoder(response).Encode(payload)
}

func writeError(response http.ResponseWriter, status int, message string) {
	writeJSON(response, status, map[string]string{"message": message})
}

func validObjectPath(path string) bool {
	return path != "" && !strings.HasPrefix(path, "/") && !strings.Contains(path, "..")
}

func newServer(store objectStore, renderer *render.Renderer, maxSourceBytes int64) http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("GET /healthz", func(response http.ResponseWriter, request *http.Request) {
		writeJSON(response, http.StatusOK, map[string]string{"status": "ok"})
	})

	mux.HandleFunc("POST /render-document", func(response http.ResponseWriter, request *http.Request) {
		var body renderDocumentRequest
		if err := json.NewDecoder(request.Body).Decode(&body); err != nil {
			writeError(response, http.StatusBadRequest, "invalid json body")
			return
		}
		if !validObjectPath(body.SourceObject) || !validObjectPath(body.OutputPrefix) ||
			!strings.HasSuffix(body.OutputPrefix, "/") {
			writeError(response, http.StatusBadRequest,
				"sourceObject and outputPrefix must be relative object paths; outputPrefix must end with /")
			return
		}
		if body.MaxPages < 1 || body.MaxPages > 100 || body.MaxPixelsPerPage < 1 || body.MaxPixelsPerPage > 16_000_000 {
			writeError(response, http.StatusBadRequest, "maxPages must be 1-100 and maxPixelsPerPage 1-16000000")
			return
		}

		size, err := store.Size(request.Context(), body.SourceObject)
		if errors.Is(err, errObjectNotFound) {
			writeError(response, http.StatusNotFound, "source pdf not found")
			return
		}
		if err != nil {
			log.Printf("size check failed: %v", err)
			writeError(response, http.StatusInternalServerError, "failed to stat source pdf")
			return
		}
		if size > maxSourceBytes {
			writeError(response, http.StatusRequestEntityTooLarge,
				fmt.Sprintf("source pdf is %dMB, max is %dMB", size/1024/1024, maxSourceBytes/1024/1024))
			return
		}

		pdfBytes, err := store.Download(request.Context(), body.SourceObject)
		if err != nil {
			log.Printf("download failed: %v", err)
			writeError(response, http.StatusInternalServerError, "failed to download source pdf")
			return
		}

		pageCount, err := renderer.RenderPages(pdfBytes, body.MaxPages, body.MaxPixelsPerPage,
			func(pageNumber int, pngBytes []byte) error {
				object := fmt.Sprintf("%spage-%d.png", body.OutputPrefix, pageNumber)
				return store.Upload(request.Context(), object, "image/png", pngBytes)
			})
		if errors.Is(err, render.ErrTooManyPages) {
			writeError(response, http.StatusUnprocessableEntity, err.Error())
			return
		}
		if errors.Is(err, render.ErrInvalidPdf) {
			writeError(response, http.StatusBadRequest, err.Error())
			return
		}
		if err != nil {
			log.Printf("render failed: %v", err)
			writeError(response, http.StatusInternalServerError, "pdf rendering failed")
			return
		}
		writeJSON(response, http.StatusOK, map[string]int{"pageCount": pageCount})
	})

	return mux
}
```

- [ ] **Step 5: Implement `main.go`**

```go
// pdf-converter: GCS-native PDF -> PNG page rasterizer for image-only LLMs.
// Auth is Cloud Run invoker IAM (no in-app auth), like apps/pdf-renderer.
package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"strconv"

	"cloud.google.com/go/storage"

	"github.com/bayesimpact/bayes-platform/apps/pdf-converter/internal/render"
)

func main() {
	bucketName := os.Getenv("GCS_STORAGE_BUCKET_NAME")
	if bucketName == "" {
		log.Fatal("GCS_STORAGE_BUCKET_NAME is required")
	}
	port := os.Getenv("PORT")
	if port == "" {
		port = "3002"
	}
	maxSourceBytes := int64(50 * 1024 * 1024)
	if fromEnv := os.Getenv("PDF_CONVERTER_MAX_PDF_BYTES"); fromEnv != "" {
		parsed, err := strconv.ParseInt(fromEnv, 10, 64)
		if err != nil {
			log.Fatalf("invalid PDF_CONVERTER_MAX_PDF_BYTES: %v", err)
		}
		maxSourceBytes = parsed
	}

	client, err := storage.NewClient(context.Background())
	if err != nil {
		log.Fatalf("gcs client: %v", err)
	}
	renderer, err := render.NewRenderer()
	if err != nil {
		log.Fatalf("renderer: %v", err)
	}

	server := newServer(&gcsStore{bucket: client.Bucket(bucketName)}, renderer, maxSourceBytes)
	log.Printf("pdf-converter listening on :%s (bucket %s)", port, bucketName)
	log.Fatal(http.ListenAndServe(":"+port, server))
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd apps/pdf-converter && go mod tidy && go vet ./... && go test ./...`
Expected: PASS.

- [ ] **Step 7: Write the Dockerfile** (build context is the repo root, matching the Makefile pattern):

```dockerfile
FROM golang:1.24-bookworm AS build
WORKDIR /src
COPY apps/pdf-converter/go.mod apps/pdf-converter/go.sum ./
RUN go mod download
COPY apps/pdf-converter/ ./
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o /pdf-converter .

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /pdf-converter /pdf-converter
ENV PORT=3002
ENTRYPOINT ["/pdf-converter"]
```

- [ ] **Step 8: Verify the image builds**

Run: `docker build --platform=linux/amd64 -t caseai-connect/pdf-converter:local -f apps/pdf-converter/Dockerfile .`
Expected: successful build.

- [ ] **Step 9: Commit**

```bash
git add apps/pdf-converter
git commit -m "feat(pdf-converter): http server with gcs-native render-document endpoint"
```

---

### Task 3: Converter CI, Makefile target, README

**Files:**
- Create: `.github/workflows/pdf-converter-ci.yml`
- Create: `apps/pdf-converter/README.md`
- Modify: `Makefile` (add `docker-build-pdf-converter` next to `docker-build-pdf-renderer`, `Makefile:87-88`)

**Interfaces:**
- Consumes: Task 2's Dockerfile and tests.
- Produces: CI coverage for `apps/pdf-converter/**`; `make docker-build-pdf-converter`.

- [ ] **Step 1: Write the workflow** (check `.github/workflows/ci.yml` first and reuse its checkout/action versions):

```yaml
name: PDF Converter CI

on:
  pull_request:
    paths: ["apps/pdf-converter/**"]
  push:
    branches: [main]
    paths: ["apps/pdf-converter/**"]

jobs:
  test:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: apps/pdf-converter
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with:
          go-version: "1.24"
          cache-dependency-path: apps/pdf-converter/go.sum
      - run: go vet ./...
      - run: go test ./...
```

- [ ] **Step 2: Add the Makefile target** — next to `docker-build-pdf-renderer` add a `localPdfConverterImage = caseai-connect/pdf-converter:local` variable (near `Makefile:13`) and:

```makefile
docker-build-pdf-converter:
	docker build --platform=linux/amd64 -t ${localPdfConverterImage} -f apps/pdf-converter/Dockerfile .
```
(Do NOT add it to the aggregate `docker-build` target's dependencies yet — the service isn't in the deploy pipeline.)

- [ ] **Step 3: Write the README** modeled on `apps/pdf-renderer/README.md`: what it does (GCS-native, go-pdfium wasm), the `/render-document` contract with the exact JSON shapes and error codes from Task 2, env vars (`GCS_STORAGE_BUCKET_NAME`, `PORT`, `PDF_CONVERTER_MAX_PDF_BYTES`), auth section (Cloud Run invoker IAM, `PDF_CONVERTER_AUTH=google-iam` on the API), local dev (`go run .` with `GOOGLE_APPLICATION_CREDENTIALS` + a dev bucket; API needs `PDF_CONVERTER_URL=http://localhost:3002`), tests (`go test ./...`), and a Deployment section stating it deploys via a manual GitHub action in the infra repo (to be created — mirror "Deploy PDF Renderer") and that it replaces `apps/pdf-renderer`.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/pdf-converter-ci.yml Makefile apps/pdf-converter/README.md
git commit -m "ci(pdf-converter): go test workflow, docker target and readme"
```

---

### Task 4: API migration — `pdf_page_count` columns

**Files:**
- Modify: `apps/api/src/domains/agents/shared/agent-session-messages/agent-message-attachment-document.entity.ts`
- Modify: `apps/api/src/domains/documents/document.entity.ts`
- Modify: `apps/api/src/domains/agents/shared/agent-session-messages/agent-message-attachment-document.factory.ts` (and the document factory if one exists — check `apps/api/src/domains/documents/` for `document.factory.ts`)
- Create (generated): `apps/api/src/migrations/<timestamp>-pdf-page-count-columns.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `AgentMessageAttachmentDocument.pdfPageCount: number | null` and `Document.pdfPageCount: number | null` (column `pdf_page_count`, integer, nullable, no default).

- [ ] **Step 1: Add the column to both entities** — in each entity add:

```typescript
  /** Rendered PNG page count in GCS (derived/{id}/page-{n}.png); null = not rendered. PDFs only. */
  @Column({ type: "integer", name: "pdf_page_count", nullable: true })
  pdfPageCount!: number | null
```

- [ ] **Step 2: Update factories** — add `pdfPageCount: null` to the factory defaults so built entities typecheck.

- [ ] **Step 3: Generate the migration** (from `apps/api`; the local DB is shared with the main checkout — this column is additive and nullable, safe):

```bash
cd apps/api
npm run migration:run          # ensure DB is current first
npm run migration:generate     # lands in src/migrations/pending/<ts>-dontsave-mig.ts
```

- [ ] **Step 4: Move + rename** the generated file to `src/migrations/<timestamp>-pdf-page-count-columns.ts`, rename the class to `PdfPageCountColumns<timestamp>` (and its `name` property). Review: `up()` must contain exactly two `ADD "pdf_page_count" integer` statements (one per table) and `down()` the two drops — no unrelated drift.

- [ ] **Step 5: Apply and verify reversibility**

```bash
npm run migration:run
npm run migration:revert
npm run migration:run
```
Expected: all three exit 0.

- [ ] **Step 6: Typecheck**

Run: `cd apps/api && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src
git commit -m "feat(api): pdf_page_count column on documents and message attachments"
```

---

### Task 5: V4 signing for `getTemporaryUrl`

**Files:**
- Modify: `apps/api/src/domains/documents/storage/gcs-storage.service.ts:49-60`

**Interfaces:**
- Consumes/Produces: unchanged signature; URLs become V4-signed (uploads already are, `gcs-storage.service.ts:75`).

- [ ] **Step 1: Add `version: "v4"`** to the `getSignedUrl` options in `getTemporaryUrl`:

```typescript
    const [url] = await file.getSignedUrl({
      version: "v4",
      action: "read",
      expires,
    })
```
Add a one-line comment: `// V4: same keyless IAM signing path as the upload URLs; V2 is legacy.`

- [ ] **Step 2: Check for existing unit coverage** — `grep -rn "getTemporaryUrl" apps/api/src --include='*.spec.ts'`; if a GcsStorageService spec asserts on the URL, update it. (LocalStorageService is what tests exercise; expect no changes.)

- [ ] **Step 3: Typecheck + commit**

```bash
cd apps/api && npx tsc --noEmit
git add apps/api/src/domains/documents/storage/gcs-storage.service.ts
git commit -m "fix(api): sign temporary read urls with v4"
```

---

### Task 6: Routes for the two public page endpoints

**Files:**
- Modify: `packages/api-contracts/src/agents/shared/agent-session-messages/agent-session-messages.routes.ts`
- Modify: `packages/api-contracts/src/documents/documents.routes.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `AgentSessionMessagesRoutes.getAttachmentPdfPageImage` (GET `organizations/:organizationId/projects/:projectId/agent-attachment-documents/:attachmentDocumentId/pdf-pages/:pageNumber`) and `DocumentsRoutes.getPdfPageImage` (GET `organizations/:organizationId/projects/:projectId/documents/:documentId/pdf-pages/:pageNumber`). Both `ResponseData<unknown>` (they 302-redirect, not JSON). Later tasks build URLs with `route.getPath({...})`.

- [ ] **Step 1: Add both routes.** In `agent-session-messages.routes.ts` (NOT under `basePath` — the attachment row is scoped by org/project only, and the URL must stay fetchable by the LLM serving stack without agent/session context):

```typescript
  // 302-redirects to a freshly signed GCS URL for one rendered pdf page (public
  // capability URL fetched server-side by the LLM serving stack; see the
  // AgentMessageAttachmentPdfPagesController docblock).
  getAttachmentPdfPageImage: defineRoute<ResponseData<unknown>>({
    method: "get",
    path: "organizations/:organizationId/projects/:projectId/agent-attachment-documents/:attachmentDocumentId/pdf-pages/:pageNumber",
  }),
```
And the equivalent `getPdfPageImage` in `documents.routes.ts` with `:documentId`.

- [ ] **Step 2: Build the package and typecheck the API**

```bash
npx turbo build --filter=@caseai-connect/api-contracts
cd apps/api && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add packages/api-contracts
git commit -m "feat(api-contracts): pdf page image redirect routes"
```

---

### Task 7: `PdfPagesModule` — converter client + pages service

**Files:**
- Create: `apps/api/src/domains/documents/pdf-pages/pdf-converter.client.ts`
- Create: `apps/api/src/domains/documents/pdf-pages/pdf-pages.service.ts`
- Create: `apps/api/src/domains/documents/pdf-pages/pdf-pages.module.ts`
- Modify: `apps/api/src/external/llm/agent-provider.ts` (receives `modelRequiresPdfAsImages`)
- Modify: `apps/api/src/external/llm/pdf-to-image-parts.ts` (re-export removed pieces — see Step 6)
- Test: `apps/api/src/domains/documents/pdf-pages/pdf-pages.service.spec.ts`

**Interfaces:**
- Consumes: routes from Task 6.
- Produces:
  - `PdfConverterClient.renderDocument({sourceObject: string, outputPrefix: string}): Promise<number>`
  - `PdfPagesService.derivedPagesPrefix(storageRelativePath: string): string`
  - `PdfPagesService.pageObjectPath(storageRelativePath: string, pageNumber: number): string`
  - `PdfPagesService.ensureRenderedPages({storageRelativePath: string, cachedPageCount: number | null}): Promise<number>`
  - `PdfPagesService.buildAttachmentPageImageUrl({organizationId, projectId, attachmentDocumentId, pageNumber}): URL`
  - `PdfPagesService.buildDocumentPageImageUrl({organizationId, projectId, documentId, pageNumber}): URL`
  - `MAX_PDF_PAGES_FOR_IMAGE_CONVERSION = 20`, `MAX_RENDERED_PIXELS_PER_PAGE = 4_000_000` (exported from `pdf-converter.client.ts`)
  - `modelRequiresPdfAsImages(model)` now exported from `@/external/llm/agent-provider`
  - `PdfPagesModule` exporting `PdfPagesService`.

- [ ] **Step 1: Move `modelRequiresPdfAsImages`** from `pdf-to-image-parts.ts:11-14` into `apps/api/src/external/llm/agent-provider.ts` (same implementation, same JSDoc). In `pdf-to-image-parts.ts`, delete the local definition and add `export { modelRequiresPdfAsImages } from "@/external/llm/agent-provider"` plus an import for its own internal uses — this keeps every existing import site working until Task 11 deletes the file. Run `cd apps/api && npx tsc --noEmit` to confirm.

- [ ] **Step 2: Write the failing service spec.** Read `apps/api/src/external/llm/pdf-to-image-parts.spec.ts` first and reuse its fetch-mocking approach. Cover:

```typescript
import { PdfConverterClient } from "./pdf-converter.client"
import { PdfPagesService } from "./pdf-pages.service"

describe("PdfPagesService", () => {
  const buildService = () => new PdfPagesService(new PdfConverterClient())

  afterEach(() => {
    jest.restoreAllMocks()
    delete process.env.PDF_CONVERTER_URL
    delete process.env.API_PUBLIC_BASE_URL
  })

  it("derives the pages prefix from the source path", () => {
    expect(buildService().derivedPagesPrefix("org1/proj1/doc1.pdf")).toBe(
      "org1/proj1/derived/doc1/",
    )
  })

  it("builds the page object path", () => {
    expect(buildService().pageObjectPath("org1/proj1/doc1.pdf", 3)).toBe(
      "org1/proj1/derived/doc1/page-3.png",
    )
  })

  it("returns the cached page count without calling the converter", async () => {
    const fetchSpy = jest.spyOn(globalThis, "fetch")
    const pageCount = await buildService().ensureRenderedPages({
      storageRelativePath: "org1/proj1/doc1.pdf",
      cachedPageCount: 4,
    })
    expect(pageCount).toBe(4)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("calls the converter with source, prefix and limits when not cached", async () => {
    process.env.PDF_CONVERTER_URL = "http://pdf-converter.test"
    const fetchSpy = jest.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ pageCount: 2 }), { status: 200 }),
    )
    const pageCount = await buildService().ensureRenderedPages({
      storageRelativePath: "org1/proj1/doc1.pdf",
      cachedPageCount: null,
    })
    expect(pageCount).toBe(2)
    const [calledUrl, calledInit] = fetchSpy.mock.calls[0]
    expect(String(calledUrl)).toBe("http://pdf-converter.test/render-document")
    expect(JSON.parse(String(calledInit?.body))).toEqual({
      sourceObject: "org1/proj1/doc1.pdf",
      outputPrefix: "org1/proj1/derived/doc1/",
      maxPages: 20,
      maxPixelsPerPage: 4_000_000,
    })
  })

  it("surfaces the converter's error message", async () => {
    process.env.PDF_CONVERTER_URL = "http://pdf-converter.test"
    jest.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ message: "page limit exceeded: pdf has 30 pages, max is 20" }), {
        status: 422,
      }),
    )
    await expect(
      buildService().ensureRenderedPages({
        storageRelativePath: "org1/proj1/doc1.pdf",
        cachedPageCount: null,
      }),
    ).rejects.toThrow("page limit exceeded")
  })

  it("builds stable attachment page urls from API_PUBLIC_BASE_URL", () => {
    process.env.API_PUBLIC_BASE_URL = "https://api.example.test"
    const url = buildService().buildAttachmentPageImageUrl({
      organizationId: "org1",
      projectId: "proj1",
      attachmentDocumentId: "att1",
      pageNumber: 2,
    })
    expect(url.toString()).toBe(
      "https://api.example.test/organizations/org1/projects/proj1/agent-attachment-documents/att1/pdf-pages/2",
    )
  })

  it("throws a clear error when API_PUBLIC_BASE_URL is unset", () => {
    expect(() =>
      buildService().buildAttachmentPageImageUrl({
        organizationId: "org1",
        projectId: "proj1",
        attachmentDocumentId: "att1",
        pageNumber: 1,
      }),
    ).toThrow("API_PUBLIC_BASE_URL")
  })
})
```

- [ ] **Step 3: Run the spec to verify it fails**

Run: `cd apps/api && node --experimental-vm-modules node_modules/.bin/jest --colors --runInBand --forceExit src/domains/documents/pdf-pages/pdf-pages.service.spec.ts`
Expected: FAIL — modules don't exist.

- [ ] **Step 4: Implement `pdf-converter.client.ts`** — port the auth/error helpers from `pdf-to-image-parts.ts:37-66,92-106` verbatim into class methods:

```typescript
import { Injectable } from "@nestjs/common"
import { GoogleAuth } from "google-auth-library"

// Guards against oversized vision requests: each page becomes one image sent
// to the model, so unbounded PDFs would blow up the request payload.
export const MAX_PDF_PAGES_FOR_IMAGE_CONVERSION = 20

// A malicious or degenerate pdf can declare an arbitrarily large page size;
// rasterizing it at full scale would allocate width*height*4 bytes per page.
export const MAX_RENDERED_PIXELS_PER_PAGE = 4_000_000

// Rendering happens once per document (cached in pdf_page_count) so a generous
// timeout is fine; the converter's own render timeout is stricter.
const RENDER_REQUEST_TIMEOUT_MS = 120_000

// In production the pdf-converter is locked behind Cloud Run invoker IAM:
// requests must carry a Google ID token minted for the service URL. Terraform
// sets PDF_CONVERTER_AUTH=google-iam on the API and workers; locally the
// converter runs open and no header is sent.
const GOOGLE_IAM_AUTH_MODE = "google-iam"

@Injectable()
export class PdfConverterClient {
  private googleAuth: GoogleAuth | undefined

  async renderDocument({
    sourceObject,
    outputPrefix,
  }: {
    sourceObject: string
    outputPrefix: string
  }): Promise<number> {
    const converterUrl = this.resolveConverterUrl()
    const endpoint = new URL(
      "render-document",
      converterUrl.endsWith("/") ? converterUrl : `${converterUrl}/`,
    )
    let response: Response
    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await this.buildAuthHeaders(converterUrl)),
        },
        body: JSON.stringify({
          sourceObject,
          outputPrefix,
          maxPages: MAX_PDF_PAGES_FOR_IMAGE_CONVERSION,
          maxPixelsPerPage: MAX_RENDERED_PIXELS_PER_PAGE,
        }),
        signal: AbortSignal.timeout(RENDER_REQUEST_TIMEOUT_MS),
      })
    } catch (error) {
      if (error instanceof Error && error.name === "TimeoutError") {
        throw new Error(`PDF rendering timed out after ${RENDER_REQUEST_TIMEOUT_MS}ms`)
      }
      const reason = error instanceof Error ? error.message : String(error)
      throw new Error(
        `PDF rendering failed: could not reach pdf-converter at ${converterUrl}: ${reason}`,
      )
    }
    if (!response.ok) {
      throw new Error(await this.extractErrorMessage(response))
    }
    return ((await response.json()) as { pageCount: number }).pageCount
  }

  private resolveConverterUrl(): string {
    const url = process.env.PDF_CONVERTER_URL
    if (!url) {
      throw new Error(
        "PDF_CONVERTER_URL is not set: converting pdfs to images for Gemma and MedGemma requires the pdf-converter service (apps/pdf-converter)",
      )
    }
    return url
  }

  private async buildAuthHeaders(converterUrl: string): Promise<Record<string, string>> {
    if (process.env.PDF_CONVERTER_AUTH !== GOOGLE_IAM_AUTH_MODE) {
      return {}
    }
    // The audience must be the Cloud Run service root URL, not the full path.
    const audience = new URL(converterUrl).origin
    this.googleAuth ??= new GoogleAuth()
    const idTokenClient = await this.googleAuth.getIdTokenClient(audience)
    const idToken = await idTokenClient.idTokenProvider.fetchIdToken(audience)
    return { Authorization: `Bearer ${idToken}` }
  }

  private async extractErrorMessage(response: Response): Promise<string> {
    const fallback = `PDF rendering failed: pdf-converter responded with HTTP ${response.status}`
    try {
      const body = (await response.json()) as { message?: string | string[] }
      if (typeof body.message === "string") return body.message
      if (Array.isArray(body.message)) return body.message.join(", ")
    } catch {
      // Non-json error body: fall through to the generic message.
    }
    return fallback
  }
}
```

- [ ] **Step 5: Implement `pdf-pages.service.ts`**

```typescript
import { AgentSessionMessagesRoutes, DocumentsRoutes } from "@caseai-connect/api-contracts"
import { Injectable } from "@nestjs/common"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { PdfConverterClient } from "./pdf-converter.client"

/**
 * Rendered-pdf-pages orchestration for image-only models (Gemma, MedGemma):
 * pages live in GCS at {org}/{proj}/derived/{sourceId}/page-{n}.png, rendered
 * once by the pdf-converter service and cached via the owning row's
 * pdf_page_count column. The model fetches pages through the public
 * pdf-pages redirect endpoints, so no image bytes ever transit this process.
 */
@Injectable()
export class PdfPagesService {
  constructor(private readonly pdfConverterClient: PdfConverterClient) {}

  derivedPagesPrefix(storageRelativePath: string): string {
    const lastSlashIndex = storageRelativePath.lastIndexOf("/")
    const directory = storageRelativePath.slice(0, lastSlashIndex)
    const baseName = storageRelativePath.slice(lastSlashIndex + 1).replace(/\.[^.]+$/, "")
    return `${directory}/derived/${baseName}/`
  }

  pageObjectPath(storageRelativePath: string, pageNumber: number): string {
    return `${this.derivedPagesPrefix(storageRelativePath)}page-${pageNumber}.png`
  }

  async ensureRenderedPages({
    storageRelativePath,
    cachedPageCount,
  }: {
    storageRelativePath: string
    cachedPageCount: number | null
  }): Promise<number> {
    if (cachedPageCount !== null) return cachedPageCount
    return this.pdfConverterClient.renderDocument({
      sourceObject: storageRelativePath,
      outputPrefix: this.derivedPagesPrefix(storageRelativePath),
    })
  }

  buildAttachmentPageImageUrl({
    organizationId,
    projectId,
    attachmentDocumentId,
    pageNumber,
  }: {
    organizationId: string
    projectId: string
    attachmentDocumentId: string
    pageNumber: number
  }): URL {
    return this.stableUrl(
      AgentSessionMessagesRoutes.getAttachmentPdfPageImage.getPath({
        organizationId,
        projectId,
        attachmentDocumentId,
        pageNumber: String(pageNumber),
      }),
    )
  }

  buildDocumentPageImageUrl({
    organizationId,
    projectId,
    documentId,
    pageNumber,
  }: {
    organizationId: string
    projectId: string
    documentId: string
    pageNumber: number
  }): URL {
    return this.stableUrl(
      DocumentsRoutes.getPdfPageImage.getPath({
        organizationId,
        projectId,
        documentId,
        pageNumber: String(pageNumber),
      }),
    )
  }

  private stableUrl(routePath: string): URL {
    const baseUrl = process.env.API_PUBLIC_BASE_URL
    if (!baseUrl) {
      throw new Error(
        "API_PUBLIC_BASE_URL is not set: it is required to build the pdf page image urls the LLM serving stack fetches",
      )
    }
    // Route paths are normalized with a leading slash by defineRoute.
    return new URL(`${baseUrl.replace(/\/+$/, "")}${routePath}`)
  }
}
```

- [ ] **Step 6: Implement `pdf-pages.module.ts`**

```typescript
import { Module } from "@nestjs/common"
import { PdfConverterClient } from "./pdf-converter.client"
import { PdfPagesService } from "./pdf-pages.service"

@Module({
  providers: [PdfConverterClient, PdfPagesService],
  exports: [PdfPagesService],
})
export class PdfPagesModule {}
```

- [ ] **Step 7: Run the spec to verify it passes**

Run: `cd apps/api && node --experimental-vm-modules node_modules/.bin/jest --colors --runInBand --forceExit src/domains/documents/pdf-pages/pdf-pages.service.spec.ts`
Expected: PASS. Then `npx tsc --noEmit`.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src packages/api-contracts
git commit -m "feat(api): pdf-pages service and pdf-converter client"
```

---

### Task 8: Public 302 redirect controllers + e2e tests

**Files:**
- Create: `apps/api/src/domains/agents/shared/agent-session-messages/agent-message-attachment-pdf-pages.controller.ts`
- Create: `apps/api/src/domains/documents/document-pdf-pages.controller.ts`
- Modify: `apps/api/src/domains/agents/conversation-agent-sessions/conversation-agent-sessions.module.ts` (register controller, import `PdfPagesModule`)
- Modify: `apps/api/src/domains/documents/documents.module.ts` (register controller, import `PdfPagesModule`)
- Test: `apps/api/src/domains/agents/shared/agent-session-messages/e2e-tests/get-attachment-pdf-page-image.spec.ts`
- Test: `apps/api/src/domains/documents/e2e-tests/get-pdf-page-image.spec.ts`

**Interfaces:**
- Consumes: `PdfPagesService.pageObjectPath` (Task 7), routes (Task 6), `pdfPageCount` columns (Task 4), `AgentMessageAttachmentDocumentsService.findById` and `DocumentsService.findById` (existing).
- Produces: the two public GET endpoints, 302 → signed URL of the derived page object; 404 for every invalid case.

- [ ] **Step 1: Read the templates** — `apps/api/src/domains/resource-libraries/resource-library-files.controller.ts` (pattern) and `apps/api/src/domains/resource-libraries/e2e-tests/download-resource-file.spec.ts` (test harness for public endpoints). Verify the exact signature of `DocumentsService.findById` (`documents.service.ts:130`) before wiring.

- [ ] **Step 2: Write the failing e2e spec for attachments.** Structure per the download-resource-file spec: `setupTransactionalTestDatabase`, create org+project with `createOrganizationWithProject(repositories)`, insert an attachment row via `repositories` (check `test-all-repositories.ts` for the exact repository property name; use the `agentMessageAttachmentDocumentFactory` with `storageRelativePath: \`${organizationId}/${projectId}/${attachmentDocumentId}.pdf\``, `mimeType: "application/pdf"`, `pdfPageCount: 3`). No auth token on requests. Cases:
  - 302 with `location` containing `/${organizationId}/${projectId}/derived/${attachmentDocumentId}/page-2.png` for page 2
  - 404 when the attachment belongs to another project (request with a different projectId)
  - 404 when `pdfPageCount` is null (not rendered yet)
  - 404 when pageNumber is `0`, `4` (out of range) or `abc` (not an integer)
  - 404 when mimeType is `image/png`

- [ ] **Step 3: Run it to verify it fails** (route not found → 404 where 302 expected).

- [ ] **Step 4: Implement the attachment controller:**

```typescript
import { AgentSessionMessagesRoutes } from "@caseai-connect/api-contracts"
import { Controller, Get, Inject, NotFoundException, Param, Res } from "@nestjs/common"
import type { Response } from "express"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { PdfPagesService } from "@/domains/documents/pdf-pages/pdf-pages.service"
import {
  FILE_STORAGE_SERVICE,
  type IFileStorage,
} from "@/domains/documents/storage/file-storage.interface"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentMessageAttachmentDocumentsService } from "./agent-message-attachment-documents.service"

/**
 * Public, unauthenticated capability endpoint (same pattern as
 * ResourceLibraryFilesController): keyed by the attachment document UUID and
 * scoped to the org/project in the path, it only ever signs derived page
 * objects under that project's own prefix. 302-redirects to a freshly signed
 * GCS URL so the LLM serving stack (vLLM fetches image_url server-side,
 * follows redirects, cannot send auth headers) can load pdf page images.
 */
@Controller()
export class AgentMessageAttachmentPdfPagesController {
  constructor(
    private readonly agentMessageAttachmentDocumentsService: AgentMessageAttachmentDocumentsService,
    private readonly pdfPagesService: PdfPagesService,
    @Inject(FILE_STORAGE_SERVICE)
    private readonly fileStorageService: IFileStorage,
  ) {}

  @Get(AgentSessionMessagesRoutes.getAttachmentPdfPageImage.path)
  async getAttachmentPdfPageImage(
    @Param("organizationId") organizationId: string,
    @Param("projectId") projectId: string,
    @Param("attachmentDocumentId") attachmentDocumentId: string,
    @Param("pageNumber") pageNumberParam: string,
    @Res() response: Response,
  ): Promise<void> {
    const attachmentDocument = await this.agentMessageAttachmentDocumentsService.findById({
      connectScope: { organizationId, projectId },
      attachmentDocumentId,
    })
    if (!attachmentDocument || attachmentDocument.mimeType !== "application/pdf") {
      throw new NotFoundException()
    }
    const pageNumber = Number(pageNumberParam)
    if (
      !Number.isInteger(pageNumber) ||
      pageNumber < 1 ||
      attachmentDocument.pdfPageCount === null ||
      pageNumber > attachmentDocument.pdfPageCount
    ) {
      throw new NotFoundException()
    }
    const pageObjectPath = this.pdfPagesService.pageObjectPath(
      attachmentDocument.storageRelativePath,
      pageNumber,
    )
    // Defense in depth: only sign derived paths under this project's own prefix.
    if (!pageObjectPath.startsWith(`${organizationId}/${projectId}/`)) {
      throw new NotFoundException()
    }
    const signedUrl = await this.fileStorageService.getTemporaryUrl(pageObjectPath)
    response.redirect(302, signedUrl)
  }
}
```
Register it in `conversation-agent-sessions.module.ts` `controllers` and add `PdfPagesModule` to its `imports` (the module already wires `StorageModule` for `FILE_STORAGE_SERVICE` — verify, add if missing).

- [ ] **Step 5: Implement the documents controller** — same shape in `document-pdf-pages.controller.ts` with `DocumentsService.findById({connectScope: {organizationId, projectId}, documentId})` (adapt to its actual signature) and `DocumentsRoutes.getPdfPageImage.path`; register in `documents.module.ts` with `PdfPagesModule` imported. Same docblock rationale.

- [ ] **Step 6: Write + run the documents e2e spec** (mirror Step 2's cases with a `documentFactory` row, `sourceType: "extraction"`).

- [ ] **Step 7: Run both e2e specs**

Run: `cd apps/api && node --experimental-vm-modules node_modules/.bin/jest --colors --runInBand --forceExit src/domains/agents/shared/agent-session-messages/e2e-tests/get-attachment-pdf-page-image.spec.ts src/domains/documents/e2e-tests/get-pdf-page-image.spec.ts`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src
git commit -m "feat(api): public 302 redirect endpoints for rendered pdf pages"
```

---

### Task 9: Chat attachment flow — render eagerly, send stable URLs

**Files:**
- Modify: `apps/api/src/domains/agents/shared/agent-session-messages/agent-message-attachment-documents.service.ts` (add `updatePdfPageCount`)
- Modify: `apps/api/src/domains/agents/shared/agent-session-messages/streaming/agent-llm-request.service.ts:84-157,246-315`
- Modify: the module(s) providing `AgentLlmRequestService` (grep `AgentLlmRequestService` in `*.module.ts`; add `PdfPagesModule` to their imports)
- Test: extend `apps/api/src/domains/agents/shared/agent-session-messages/streaming/streaming-llm.service.spec.ts` (or the existing spec that covers `handleAttachmentDocumentInLLMMessage` — grep `attachmentDocument` in `streaming/*.spec.ts` and pick the file that already builds LLM requests)

**Interfaces:**
- Consumes: `PdfPagesService` (Task 7), `modelRequiresPdfAsImages` from `@/external/llm/agent-provider` (Task 7), `pdfPageCount` (Task 4).
- Produces: `AgentMessageAttachmentDocumentsService.updatePdfPageCount({connectScope, attachmentDocumentId, pdfPageCount}): Promise<void>`; `handleAttachmentDocumentInLLMMessage` gains a `model: string` param; for PDF + image-only model the built message contains one `{type: "image", image: URL}` part per page.

- [ ] **Step 1: Write the failing test.** In the chosen spec file, add a case: agent settings model = a Gemma enum value (pick one from `AgentModelToAgentProvider` mapping to `AgentProvider.Gemma`), `GCS_STORAGE_BUCKET_NAME` and `API_PUBLIC_BASE_URL` set via `process.env` in the test (restore after), attachment document row with `mimeType: "application/pdf"`, `pdfPageCount: null`, PdfPagesService mocked (via module override or `jest.spyOn`) so `ensureRenderedPages` resolves `2`. Assert:
  - the last LLM message content is `[{type: "text", ...}, {type: "image", image: URL(...page-1...)}, {type: "image", image: URL(...page-2...)}]` — check the URL strings end with `/agent-attachment-documents/<id>/pdf-pages/1` and `/2`
  - `ensureRenderedPages` was called with the attachment's `storageRelativePath` and `cachedPageCount: null`
  - the attachment row's `pdfPageCount` is `2` afterwards (via repository read)
  - a second build with `pdfPageCount` already `2` does NOT call `ensureRenderedPages`... (it is still called but returns the cache — assert `PdfConverterClient` fetch not called, or assert `ensureRenderedPages` receives `cachedPageCount: 2`)
  Also add: model = Gemma + PDF + `GCS_STORAGE_BUCKET_NAME` unset → build rejects with an error mentioning `GCS_STORAGE_BUCKET_NAME`.

- [ ] **Step 2: Run it to verify it fails.**

- [ ] **Step 3: Add `updatePdfPageCount`** to `AgentMessageAttachmentDocumentsService` (check `ConnectRepository.updateOneById`'s exact signature at `apps/api/src/common/entities/connect-repository.ts:180` and match it):

```typescript
  async updatePdfPageCount({
    attachmentDocumentId,
    connectScope,
    pdfPageCount,
  }: {
    attachmentDocumentId: string
    connectScope: RequiredConnectScope
    pdfPageCount: number
  }): Promise<void> {
    await this.attachmentDocumentConnectRepository.updateOneById({
      connectScope,
      id: attachmentDocumentId,
      update: { pdfPageCount },
    })
  }
```

- [ ] **Step 4: Wire the new branch.** In `agent-llm-request.service.ts`:
  - Inject `PdfPagesService` in the constructor (regular import + biome-ignore DI comment); add `PdfPagesModule` to every module that provides `AgentLlmRequestService`.
  - `buildLLMRequest` passes `model: agentSettings.model` into `handleAttachmentDocumentInLLMMessage` (also update any other caller — grep `handleAttachmentDocumentInLLMMessage` for a second call site, e.g. the single-turn runner around line 159+).
  - In `handleAttachmentDocumentInLLMMessage`, replace the `case "application/pdf":` block body with:

```typescript
      case "application/pdf":
        {
          if (modelRequiresPdfAsImages(model)) {
            // Image-only models: send one rendered page image URL per page. The
            // pages live in GCS (rendered once by pdf-converter, cached via
            // pdf_page_count) and the model fetches them through the public
            // pdf-pages redirect endpoint — no pdf/image bytes in this process.
            if (!hasStorageBucketName) {
              throw new Error(
                "PDF attachments with Gemma/MedGemma models require GCS storage and the pdf-converter service (set GCS_STORAGE_BUCKET_NAME and PDF_CONVERTER_URL)",
              )
            }
            const pdfPageCount = await this.pdfPagesService.ensureRenderedPages({
              storageRelativePath: attachmentDocument.storageRelativePath,
              cachedPageCount: attachmentDocument.pdfPageCount,
            })
            if (attachmentDocument.pdfPageCount === null) {
              await this.agentMessageAttachmentDocumentsService.updatePdfPageCount({
                attachmentDocumentId,
                connectScope,
                pdfPageCount,
              })
            }
            const content = llmMessage.content as Array<ImagePart>
            for (let pageNumber = 1; pageNumber <= pdfPageCount; pageNumber++) {
              content.push({
                type: "image",
                image: this.pdfPagesService.buildAttachmentPageImageUrl({
                  organizationId: connectScope.organizationId,
                  projectId: connectScope.projectId,
                  attachmentDocumentId,
                  pageNumber,
                }),
              })
            }
            break
          }

          // Other models accept pdf file parts directly (signed URL; the AI
          // SDK downloads it when the provider doesn't support URLs).
          const data = new URL(
            hasStorageBucketName
              ? url
              : "https://www.impots.gouv.fr/sites/default/files/formulaires/2042/2025/2042_5180.pdf",
          )
          const content = llmMessage.content as Array<FilePart>
          content.push({
            type: "file",
            mediaType: "application/pdf",
            data,
            filename: attachmentDocument.fileName,
          })
        }
        break
```
  (Move the `getTemporaryUrl` call so it only runs on the paths that need `url` — the image-parts branch doesn't.) Import `modelRequiresPdfAsImages` from `@/external/llm/agent-provider`.

- [ ] **Step 5: Run the spec + typecheck**

Run: the spec file from Step 1 with the jest invocation, then `npx tsc --noEmit`.
Expected: PASS / clean.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src
git commit -m "feat(api): chat pdf attachments become stable page image urls for gemma models"
```

---

### Task 10: Extraction flow — same treatment for documents

**Files:**
- Modify: `apps/api/src/domains/documents/documents.service.ts` (add `updatePdfPageCount`, mirror `updateContent` at `documents.service.ts:183-206`)
- Modify: `apps/api/src/domains/agents/extraction-agent-sessions/extraction-agent-session-runner.service.ts:106-125,194-245`
- Modify: `apps/api/src/domains/agents/extraction-agent-sessions/extraction-agent-sessions.module.ts` (or wherever the runner is provided — import `PdfPagesModule`)
- Test: extend `apps/api/src/domains/agents/extraction-agent-sessions/extraction-agent-session-run-llm.service.spec.ts`

**Interfaces:**
- Consumes: `PdfPagesService`, `modelRequiresPdfAsImages`, `Document.pdfPageCount`.
- Produces: `DocumentsService.updatePdfPageCount({connectScope, documentId, pdfPageCount}): Promise<void>`; `buildLLMMessage` gains `model: string` and `connectScope: RequiredConnectScope` params and emits image-URL parts for PDF + image-only model.

- [ ] **Step 1: Write the failing test** in the runner spec: extraction agent with a Gemma model, PDF document with `pdfPageCount: null`, `GCS_STORAGE_BUCKET_NAME`/`API_PUBLIC_BASE_URL` set, `PdfPagesService.ensureRenderedPages` mocked to resolve `2`; assert the message passed to `generateStructuredOutput` contains two image parts whose URLs end with `/documents/<documentId>/pdf-pages/1` and `/2`, and the document row's `pdfPageCount` becomes `2`. Follow the existing spec's mocking style for the LLM provider.

- [ ] **Step 2: Run it to verify it fails.**

- [ ] **Step 3: Add `DocumentsService.updatePdfPageCount`:**

```typescript
  async updatePdfPageCount({
    connectScope,
    documentId,
    pdfPageCount,
  }: {
    connectScope: RequiredConnectScope
    documentId: string
    pdfPageCount: number
  }): Promise<void> {
    await this.documentRepository.update(
      {
        id: documentId,
        organizationId: connectScope.organizationId,
        projectId: connectScope.projectId,
      },
      { pdfPageCount },
    )
  }
```
(Match the exact `where` shape `updateContent` uses at `documents.service.ts:194` — copy it.)

- [ ] **Step 4: Wire the runner.** Inject `PdfPagesService` and `DocumentsService` if not already injected (check the constructor); pass `model: agentSettings.model` and the run's `connectScope` into `buildLLMMessage`; in its `case "application/pdf":` add the same branch as Task 9 Step 4 but using `buildDocumentPageImageUrl({organizationId, projectId, documentId: document.id, pageNumber})`, `document.pdfPageCount` as the cache, `documentsService.updatePdfPageCount` for persistence, and the same clear error when `GCS_STORAGE_BUCKET_NAME` is unset (compute `hasStorageBucketName` the same way: `!!process.env.GCS_STORAGE_BUCKET_NAME`). Keep the existing `getTemporaryUrl`+FilePart path for non-image-only models.

- [ ] **Step 5: Run the spec + typecheck; run the extraction e2e folder**

```bash
cd apps/api && node --experimental-vm-modules node_modules/.bin/jest --colors --runInBand --forceExit src/domains/agents/extraction-agent-sessions
npx tsc --noEmit
```
Expected: PASS / clean.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src
git commit -m "feat(api): extraction pdf documents become stable page image urls for gemma models"
```

---

### Task 11: MedGemma URL passthrough

**Files:**
- Modify: `apps/api/src/external/llm/providers/medgemma/custom-med-gemma-language-model.ts:37-42,198-217`
- Test: `apps/api/src/external/llm/providers/medgemma/custom-med-gemma-language-model.spec.ts` (create if absent — check for an existing spec first)

**Interfaces:**
- Consumes: image parts whose `data` is a `URL` (Tasks 9/10 — the AI SDK forwards them untouched once `supportedUrls` matches).
- Produces: request bodies with `{"type": "image_url", "image_url": {"url": "https://..."}}` for URL parts; base64 `data:` URLs still emitted for byte parts. (The Gemma provider needs NO change: `@ai-sdk/openai` chat models already declare `supportedUrls: {"image/*": [/^https?:\/\/.*$/]}` — verified in `node_modules/@ai-sdk/openai/dist/index.js:652`.)

- [ ] **Step 1: Write the failing test:** instantiate `CustomMedGemmaLanguageModel({baseUrl: "http://medgemma.test", apiKey: "k", config: {model: "<a MedGemma AgentModel value>", ...minimal LLMConfig}})`, mock `globalThis.fetch` to capture the request and return a minimal chat-completions JSON (`{choices: [{message: {content: "{}"}, finish_reason: "stop"}], usage: {prompt_tokens: 1, completion_tokens: 1}}`), call `doGenerate` with `providerOptions: {custom: {callOrigin: CallOrigin.generateStructuredOutput}}`, `responseFormat: {type: "json", schema: {type: "object", properties: {}}}`, and a prompt containing a user message with a file part `{type: "file", mediaType: "image/png", data: new URL("https://api.example.test/organizations/o/projects/p/agent-attachment-documents/a/pdf-pages/1")}`. Assert the captured body's message content includes `{type: "image_url", image_url: {url: "https://api.example.test/..."}}` and no `data:` prefix. Add a second case with `data: new Uint8Array([1, 2, 3])` asserting the existing base64 `data:image/jpeg;base64,...` behavior still holds.

- [ ] **Step 2: Run it to verify it fails** (URL part currently hits `Buffer.from(value.data)` and produces a garbage data URL — assert catches it).

- [ ] **Step 3: Implement.** Broaden `supportedUrls` (line 38-42) so the AI SDK stops downloading https images:

```typescript
  // Image URLs are passed through to the vLLM endpoint, which fetches them
  // server-side (and follows the 302 from our pdf-pages redirect endpoints).
  get supportedUrls() {
    return {
      "image/*": [/^https?:\/\/.*$/],
    }
  }
```
And in `toInput`'s `case "file":` (line 198), before the Buffer path:

```typescript
          case "file": {
            if (!value.mediaType.startsWith("image/"))
              throw new Error(`MedGemma model cannot process ${value.mediaType} file`)
            if (value.data instanceof URL) {
              contents.push({
                type: "image_url",
                image_url: { url: value.data.toString() },
              })
              break
            }
            const buf = Buffer.from(value.data)
            // ... existing base64 branch unchanged
```

- [ ] **Step 4: Run the spec + typecheck.** Expected: PASS / clean.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src
git commit -m "feat(api): medgemma passes image urls through to vllm instead of inlining base64"
```

---

### Task 12: Delete the byte pump + env/docs + full gates

**Files:**
- Delete: `apps/api/src/external/llm/pdf-to-image-parts.ts`, `apps/api/src/external/llm/pdf-to-image-parts.spec.ts`
- Modify: `apps/api/src/external/llm/ai-sdk-llm-provider-base.ts:26-28,295-298,756-759`
- Modify: `apps/api/.env-example` (PDF_RENDERER block → converter block)
- Modify: `CLAUDE.md` (project structure list), `apps/pdf-renderer/README.md` (deprecation note)

**Interfaces:**
- Consumes: everything above.
- Produces: no code path fetches PDF bytes into the API for image conversion; `PDF_RENDERER_URL` is unused by the API.

- [ ] **Step 1: Remove both conversion call sites** in `ai-sdk-llm-provider-base.ts` — the `if (modelRequiresPdfAsImages(config.model)) { ... }` blocks at lines 295-298 (streamChatResponse) and 756-759 (generateStructuredOutput), including their comment lines, and the `convertPdfPartsToImageParts`/`modelRequiresPdfAsImages` imports at lines 26-28. Keep the Mistral PDF rejection (lines 760-768).

- [ ] **Step 2: Delete the files** `pdf-to-image-parts.ts` + `pdf-to-image-parts.spec.ts`, then `grep -rn "pdf-to-image-parts\|convertPdfPartsToImageParts\|MAX_PDF_BYTES_FOR_IMAGE_CONVERSION" apps/api/src` and fix every remaining import: `modelRequiresPdfAsImages` → `@/external/llm/agent-provider`; `MAX_PDF_PAGES_FOR_IMAGE_CONVERSION`/`MAX_RENDERED_PIXELS_PER_PAGE` → `@/domains/documents/pdf-pages/pdf-converter.client`; `MAX_PDF_BYTES_FOR_IMAGE_CONVERSION` has no successor (the 32MiB HTTP cap no longer applies) — delete its uses.

- [ ] **Step 3: Update `.env-example`** — replace the `PDF_RENDERER_URL` block (lines ~103-106) with:

```
# --- PDF converter (apps/pdf-converter): renders pdf pages to png in GCS for image-only models (Gemma, MedGemma)
PDF_CONVERTER_URL=http://localhost:3002
# Set by terraform in production (Cloud Run invoker IAM); leave unset locally:
# PDF_CONVERTER_AUTH=google-iam
# Public base url of this API; used to build the stable pdf page image urls fetched by the vLLM endpoints
API_PUBLIC_BASE_URL=http://localhost:3000
```

- [ ] **Step 4: Update docs** — root `CLAUDE.md` project structure: add `apps/pdf-converter` line ("Go service rendering PDFs to PNG page images in GCS for image-only LLMs, port 3002") and mark `apps/pdf-renderer` as deprecated/being replaced. Top of `apps/pdf-renderer/README.md`: add a "Deprecated: replaced by apps/pdf-converter; remove once the converter is live in all environments" banner.

- [ ] **Step 5: Full verification gates** (all must exit 0):

```bash
npm run biome:check          # repo root (rewrites files — re-stage after)
npm run typecheck            # repo root
cd apps/api && npm run check:boundaries
make tests-parallel          # or: cd apps/api && npm run test:parallel
cd apps/pdf-converter && go vet ./... && go test ./...
```
Known flakiness: SIGTERM'd jest workers and the csv-extraction cancel-one spec — re-run failing files in isolation before treating them as real failures.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(api)!: replace pdf byte-pump conversion with gcs-native pdf-converter urls"
```

---

## Post-merge / infra checklist (not code tasks — hand to whoever owns infra)

1. Terraform (infra repo): `pdf-converter` Cloud Run service (image from Task 2's Dockerfile, 1–2GB RAM, min instances 0), SA with `roles/storage.objectAdmin` on the storage bucket, `roles/run.invoker` granted to the API + workers SA; API/workers env: `PDF_CONVERTER_URL`, `PDF_CONVERTER_AUTH=google-iam`, `API_PUBLIC_BASE_URL=<public API URL>`.
2. Infra repo: "Deploy PDF Converter" GitHub action (clone of "Deploy PDF Renderer" pointing at `make docker-build-pdf-converter` / the new image).
3. Smoke-test prod egress once deployed: send a Gemma chat completion whose `image_url` points at any public PNG; if the vLLM endpoint cannot fetch it (private egress), fall back plan: API downloads page bytes per request (small, page-sized) — requires a follow-up task, not this plan.
4. After the converter is live and the API deployed: decommission `apps/pdf-renderer` (delete app, `docker-build-pdf-renderer` target, `tests-parallel` line `Makefile:255`, trivy scan entry in `.github/workflows/security.yml`, `PDF_RENDERER_*` envs, infra service) in its own PR.
