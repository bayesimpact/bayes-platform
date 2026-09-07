package main

import (
	"context"
	_ "embed"
	"errors"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"
	"unicode"

	"github.com/google/uuid"
	"github.com/modelcontextprotocol/go-sdk/mcp"
	"golang.org/x/sync/semaphore"

	"github.com/bayesimpact/bayes-platform/apps/pdf-converter/internal/mdpdf"
)

const (
	pdfExportToolName = "convert_markdown_to_pdf"
	// downloadCardURI is the MCP App resource the tool points at through
	// _meta.ui.resourceUri; the host reads it and renders it in an iframe.
	downloadCardURI = "ui://pdf-export/download-card"
	mcpAppMIMEType  = "text/html;profile=mcp-app"
	// defaultPdfExportPrefix keeps exports in one place so the API workers can
	// sweep them by prefix.
	defaultPdfExportPrefix = "tmp/pdf-exports/"
	pdfExportMaxPages      = 200
	// maxFileNameRunes caps the sanitized download name well below the GCS
	// object-name limit while leaving room for the prefix and the id.
	maxFileNameRunes = 100
	// maxPdfExportTTLMinutes is GCS V4 signing's own limit (seven days); a
	// config above this would start the service and then fail every export
	// once uploaded.
	maxPdfExportTTLMinutes = 7 * 24 * 60
	// maxConcurrentRenders bounds how many exports render at once. Every
	// render goes through the same shared pdfium worker pool for page
	// counting, and Cloud Run hands one instance several concurrent requests,
	// so unbounded renders would queue on that pool while each holding a full
	// document in memory.
	maxConcurrentRenders = 4
)

//go:embed card.html
var downloadCardHTML string

// pdfExportConfig holds everything the MCP tool needs that is not the store.
type pdfExportConfig struct {
	TTL              time.Duration
	MaxMarkdownBytes int
	// TmpPrefix ends with "/" and is a valid relative object path.
	TmpPrefix string
	Timeout   time.Duration
	MaxPages  int
	// Now and NewID are injection points for tests; nil means time.Now and
	// uuid.NewString.
	Now   func() time.Time
	NewID func() string
}

func (cfg pdfExportConfig) now() time.Time {
	if cfg.Now == nil {
		return time.Now()
	}
	return cfg.Now()
}

func (cfg pdfExportConfig) newID() string {
	if cfg.NewID == nil {
		return uuid.NewString()
	}
	return cfg.NewID()
}

// The "1 MiB" in the markdown description is the default of
// PDF_EXPORT_MAX_MARKDOWN_BYTES spelled out for the model; update it by hand if
// that default changes.
type convertMarkdownInput struct {
	Markdown string `json:"markdown" jsonschema:"GitHub Flavored Markdown to convert into a PDF (headings, lists, tables, code blocks, links). Maximum 1 MiB."`
	FileName string `json:"fileName,omitempty" jsonschema:"Optional download file name. Characters outside letters, digits, dot, underscore, space and dash are removed and .pdf is appended. Defaults to document.pdf."`
	Title    string `json:"title,omitempty" jsonschema:"Optional document title for the PDF metadata and header. Defaults to the first level-1 heading, then to the file name."`
}

type convertMarkdownOutput struct {
	DownloadURL string `json:"downloadUrl" jsonschema:"Signed HTTPS URL to download the PDF. Expires at expiresAt."`
	FileName    string `json:"fileName" jsonschema:"File name of the generated PDF."`
	PageCount   int    `json:"pageCount" jsonschema:"Number of pages in the PDF."`
	SizeBytes   int64  `json:"sizeBytes" jsonschema:"Size of the PDF in bytes."`
	ExpiresAt   string `json:"expiresAt" jsonschema:"RFC 3339 timestamp after which downloadUrl stops working."`
}

// pdfExporter renders markdown, stores the PDF and hands back a signed link.
type pdfExporter struct {
	store objectStore
	cfg   pdfExportConfig
	// renderSlots caps concurrent renders at maxConcurrentRenders.
	renderSlots *semaphore.Weighted
}

func (exporter *pdfExporter) convert(
	ctx context.Context,
	_ *mcp.CallToolRequest,
	in convertMarkdownInput,
) (*mcp.CallToolResult, convertMarkdownOutput, error) {
	// A plain error return is turned by the SDK into an IsError result whose
	// content is the error text, and output marshaling is skipped — that is
	// what every validation failure below wants.
	markdown := strings.TrimSpace(in.Markdown)
	if markdown == "" {
		return nil, convertMarkdownOutput{}, errors.New("markdown is empty")
	}
	if len(markdown) > exporter.cfg.MaxMarkdownBytes {
		return nil, convertMarkdownOutput{}, fmt.Errorf(
			"markdown is %d bytes, max is %d", len(markdown), exporter.cfg.MaxMarkdownBytes)
	}

	fileName := sanitizeFileName(in.FileName)
	renderCtx, cancelRender := context.WithTimeout(ctx, exporter.cfg.Timeout)
	defer cancelRender()
	// Waiting for a slot is part of the render budget: an export that cannot
	// get one before renderCtx expires fails like any other render timeout.
	if err := exporter.renderSlots.Acquire(renderCtx, 1); err != nil {
		log.Printf("pdf export waited too long for a render slot: %v", err)
		return nil, convertMarkdownOutput{}, errors.New("could not render the PDF, try again")
	}
	rendered, err := mdpdf.Render(renderCtx, []byte(markdown), mdpdf.Options{
		Title:    in.Title,
		FileName: fileName,
		MaxPages: exporter.cfg.MaxPages,
	})
	exporter.renderSlots.Release(1)
	if errors.Is(err, mdpdf.ErrTooManyPages) {
		return nil, convertMarkdownOutput{}, fmt.Errorf(
			"the document would exceed %d pages, split it into smaller documents", exporter.cfg.MaxPages)
	}
	if err != nil {
		log.Printf("pdf export render failed: %v", err)
		return nil, convertMarkdownOutput{}, errors.New("could not render the PDF, try again")
	}

	// Sign before uploading: BucketHandle.SignedURL does not need the object
	// to exist, and signing first means a signing failure never leaves an
	// orphaned upload in the bucket.
	object := exporter.cfg.TmpPrefix + exporter.cfg.newID() + "/" + fileName
	expires := exporter.cfg.now().Add(exporter.cfg.TTL)
	downloadURL, err := exporter.store.SignedURL(renderCtx, object, signedURLOptions{
		Expires:          expires,
		DownloadFileName: fileName,
	})
	if err != nil {
		log.Printf("pdf export signing of %s failed: %v", object, err)
		return nil, convertMarkdownOutput{}, errors.New("could not store the PDF, try again")
	}
	if err := exporter.store.Upload(renderCtx, object, "application/pdf", rendered.PDF); err != nil {
		log.Printf("pdf export upload to %s failed: %v", object, err)
		return nil, convertMarkdownOutput{}, errors.New("could not store the PDF, try again")
	}

	out := convertMarkdownOutput{
		DownloadURL: downloadURL,
		FileName:    fileName,
		PageCount:   rendered.PageCount,
		SizeBytes:   int64(len(rendered.PDF)),
		ExpiresAt:   expires.UTC().Format(time.RFC3339),
	}
	// Content is set explicitly: left nil, the SDK would copy the structured
	// JSON — signed URL included — into the model-visible text.
	return &mcp.CallToolResult{
		Content: []mcp.Content{&mcp.TextContent{Text: fmt.Sprintf(
			"Created %s (%d page(s), %s). The user can download it from the card shown in the conversation; the link expires at %s.",
			out.FileName, out.PageCount, humanSize(out.SizeBytes), out.ExpiresAt)}},
	}, out, nil
}

// humanSize formats a byte count for the model-visible summary and mirrors the
// card's own formatting.
func humanSize(bytes int64) string {
	switch {
	case bytes >= 1024*1024:
		return fmt.Sprintf("%.1f MB", float64(bytes)/(1024*1024))
	case bytes >= 1024:
		return fmt.Sprintf("%d KB", bytes/1024)
	default:
		return fmt.Sprintf("%d B", bytes)
	}
}

// sanitizeFileName turns an agent-supplied name into a safe single-segment
// object name ending in .pdf. Unicode letters and digits are kept, so an
// accented or non-Latin name survives (GCS object names are UTF-8); everything
// outside letters, digits, dot, underscore, space and dash is dropped, which
// also removes path separators, quotes and control characters. The download
// header quotes an ASCII fallback next to the real name, see store.SignedURL.
func sanitizeFileName(name string) string {
	trimmed := strings.TrimSpace(name)
	// Strip every trailing .pdf, not just one: "report.pdf.pdf" must not come
	// back out as "report.pdf.pdf" once the single .pdf below is re-appended.
	for strings.HasSuffix(strings.ToLower(trimmed), ".pdf") {
		trimmed = trimmed[:len(trimmed)-len(".pdf")]
	}
	var kept strings.Builder
	previousWasSpace := false
	for _, letter := range trimmed {
		isSpace := unicode.IsSpace(letter)
		switch {
		case isSpace:
			// Collapse whitespace runs (and any run broken up by dropped
			// characters) into a single space.
			if !previousWasSpace {
				kept.WriteRune(' ')
			}
		case unicode.IsLetter(letter), unicode.IsDigit(letter),
			letter == '.', letter == '_', letter == '-':
			kept.WriteRune(letter)
		default:
			continue
		}
		previousWasSpace = isSpace
	}
	cleaned := strings.Trim(kept.String(), ". ")
	if runes := []rune(cleaned); len(runes) > maxFileNameRunes {
		cleaned = strings.Trim(string(runes[:maxFileNameRunes]), ". ")
	}
	if cleaned == "" {
		cleaned = "document"
	}
	return cleaned + ".pdf"
}

func newMCPServer(store objectStore, cfg pdfExportConfig) *mcp.Server {
	server := mcp.NewServer(&mcp.Implementation{
		Name:    "pdf-converter",
		Title:   "PDF converter",
		Version: "1.0.0",
	}, nil)

	exporter := &pdfExporter{
		store:       store,
		cfg:         cfg,
		renderSlots: semaphore.NewWeighted(maxConcurrentRenders),
	}
	// The "15 minutes" below is the default of PDF_EXPORT_TTL_MINUTES spelled
	// out for the model; update it by hand if that default changes.
	mcp.AddTool(server, &mcp.Tool{
		Name:  pdfExportToolName,
		Title: "Export markdown as PDF",
		Description: "Convert markdown into a downloadable PDF. The chat shows a download card with the " +
			"file name, page count and a Download button; the link expires after 15 minutes. " +
			"Do not paste the download link in your reply, point the user to the card instead.",
		Meta: mcp.Meta{"ui": map[string]any{"resourceUri": downloadCardURI}},
	}, exporter.convert)

	server.AddResource(&mcp.Resource{
		URI:         downloadCardURI,
		Name:        "pdf-export-download-card",
		Title:       "PDF download card",
		Description: "MCP App card showing the generated PDF and its download button.",
		MIMEType:    mcpAppMIMEType,
	}, func(_ context.Context, _ *mcp.ReadResourceRequest) (*mcp.ReadResourceResult, error) {
		return &mcp.ReadResourceResult{Contents: []*mcp.ResourceContents{{
			URI:      downloadCardURI,
			MIMEType: mcpAppMIMEType,
			Text:     downloadCardHTML,
		}}}, nil
	})

	return server
}

func newMCPHandler(store objectStore, cfg pdfExportConfig) http.Handler {
	server := newMCPServer(store, cfg)
	return mcp.NewStreamableHTTPHandler(
		func(*http.Request) *mcp.Server { return server },
		&mcp.StreamableHTTPOptions{
			Stateless: true,
			// Room for the markdown itself plus its JSON-RPC envelope and the
			// JSON escaping of the worst case.
			MaxRequestBodyBytes: int64(2*cfg.MaxMarkdownBytes + 64*1024),
		})
}
