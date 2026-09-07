package mdpdf

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"strings"
	"sync"
	"testing"

	"github.com/bayesimpact/bayes-platform/apps/pdf-converter/internal/render"
	"github.com/yuin/goldmark"
	"github.com/yuin/goldmark/ast"
	"github.com/yuin/goldmark/extension"
	"github.com/yuin/goldmark/text"
)

// The pdfium pool is expensive to start, so every test shares one renderer.
var (
	pdfiumOnce     sync.Once
	pdfiumRenderer *render.Renderer
	pdfiumErr      error
)

// parsedPageCount proves the output is a real PDF by parsing and rasterizing
// it with pdfium, and returns the page count pdfium sees. The pixel budget is
// deliberately tiny: the point is parseability, not image quality.
func parsedPageCount(t *testing.T, pdfBytes []byte) int {
	t.Helper()
	pdfiumOnce.Do(func() {
		pdfiumRenderer, pdfiumErr = render.NewRenderer()
	})
	if pdfiumErr != nil {
		t.Fatalf("start pdfium: %v", pdfiumErr)
	}
	pageCount, err := pdfiumRenderer.RenderPages(
		context.Background(), pdfBytes, 1000, 1024,
		func(pageNumber int, pngBytes []byte) error {
			if len(pngBytes) == 0 {
				return fmt.Errorf("page %d rendered to no pixels", pageNumber)
			}
			return nil
		})
	if err != nil {
		t.Fatalf("pdfium could not parse the rendered pdf: %v", err)
	}
	return pageCount
}

// renderOk renders markdown and checks the basics every test cares about: no
// error, a PDF header, and a document pdfium agrees on.
func renderOk(t *testing.T, markdown string, opts Options) Result {
	t.Helper()
	result, err := Render(context.Background(), []byte(markdown), opts)
	if err != nil {
		t.Fatalf("Render returned %v", err)
	}
	if !bytes.HasPrefix(result.PDF, []byte("%PDF-")) {
		t.Fatalf("output does not start with %%PDF-, got %q", result.PDF[:min(8, len(result.PDF))])
	}
	if parsed := parsedPageCount(t, result.PDF); parsed != result.PageCount {
		t.Fatalf("pdfium counted %d pages, Result.PageCount is %d", parsed, result.PageCount)
	}
	return result
}

func TestRenderInlineFormatting(t *testing.T) {
	markdown := `# Release notes

A paragraph with **bold**, *italic*, ~~struck out~~ and ` + "`inline code`" + `
plus a [link](https://example.com) at the end.

---

Second paragraph after a thematic break.
`
	result := renderOk(t, markdown, Options{FileName: "notes.md"})

	if result.PageCount != 1 {
		t.Errorf("expected a single page, got %d", result.PageCount)
	}
	if result.Title != "Release notes" {
		t.Errorf("expected the H1 as title, got %q", result.Title)
	}
	if !bytes.Contains(result.PDF, []byte("/URI (https://example.com)")) {
		t.Error("the rendered pdf has no link annotation for https://example.com")
	}
}

func TestRenderOnePageStaysSmall(t *testing.T) {
	result := renderOk(t, "# Pricing\n\nOne short paragraph of text.\n", Options{})

	// Embedding five whole DejaVu faces would be several megabytes; only the
	// glyphs actually used may end up in the file.
	const maxSize = 400 * 1024
	if len(result.PDF) > maxSize {
		t.Errorf("a one-page pdf weighs %d bytes, want under %d", len(result.PDF), maxSize)
	}
}

// longMarkdown is the shared fixture for the pagination and page-cap tests.
func longMarkdown(paragraphs int) string {
	var builder strings.Builder
	builder.WriteString("# Product overview\n\n")
	for paragraphIndex := 1; paragraphIndex <= paragraphs; paragraphIndex++ {
		fmt.Fprintf(&builder,
			"Paragraph %d: pricing, support and onboarding notes for the current quarter.\n\n",
			paragraphIndex)
	}
	return builder.String()
}

func TestRenderPaginatesLongDocument(t *testing.T) {
	result := renderOk(t, longMarkdown(400), Options{})

	if result.PageCount <= 1 {
		t.Fatalf("expected several pages, got %d", result.PageCount)
	}
}

func TestRenderRejectsDocumentOverMaxPages(t *testing.T) {
	_, err := Render(context.Background(), []byte(longMarkdown(400)), Options{MaxPages: 2})

	if !errors.Is(err, ErrTooManyPages) {
		t.Fatalf("expected ErrTooManyPages, got %v", err)
	}
}

func TestRenderTable(t *testing.T) {
	markdown := `| Feature | Description | Status |
| :--- | :---: | ---: |
| Pricing | A fairly long description that has to wrap inside its own cell because it does not fit on one line | Ready |
| Support | Short | Planned |
`
	result := renderOk(t, markdown, Options{Title: "Feature matrix"})

	if result.PageCount != 1 {
		t.Errorf("expected a single page, got %d", result.PageCount)
	}
}

func TestRenderWideTableDegradesToText(t *testing.T) {
	const columns = 12
	header := make([]string, columns)
	divider := make([]string, columns)
	body := make([]string, columns)
	for columnIndex := range header {
		header[columnIndex] = fmt.Sprintf("Column %d", columnIndex+1)
		divider[columnIndex] = "---"
		body[columnIndex] = fmt.Sprintf("Value %d", columnIndex+1)
	}
	markdown := fmt.Sprintf("| %s |\n| %s |\n| %s |\n",
		strings.Join(header, " | "), strings.Join(divider, " | "), strings.Join(body, " | "))

	renderOk(t, markdown, Options{Title: "Wide table"})
}

func TestFitColumns(t *testing.T) {
	testCases := []struct {
		name      string
		natural   []float64
		available float64
		want      []float64
	}{
		{
			name:      "narrow columns grow to span the width",
			natural:   []float64{20, 30},
			available: 100,
			want:      []float64{40, 60},
		},
		{
			name:      "one wide column absorbs the overflow",
			natural:   []float64{20, 200, 30},
			available: 100,
			want:      []float64{20, 50, 30},
		},
		{
			name:      "columns over the fair share share what is left",
			natural:   []float64{80, 90},
			available: 100,
			want:      []float64{50, 50},
		},
	}
	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			got := fitColumns(testCase.natural, testCase.available)

			if len(got) != len(testCase.want) {
				t.Fatalf("fitColumns returned %d widths, want %d", len(got), len(testCase.want))
			}
			for columnIndex, width := range got {
				if width != testCase.want[columnIndex] {
					t.Errorf("column %d is %g wide, want %g",
						columnIndex, width, testCase.want[columnIndex])
				}
			}
		})
	}
}

func TestRenderNonLatinScripts(t *testing.T) {
	markdown := `# Résumé des évolutions

Le tarif a été révisé, la fonctionnalité est prête à être déployée.

Die Größe der Übersicht ändert sich für alle Benutzerkonten.

Δοκιμή της ελληνικής γραφής σε μια παράγραφο.

Проверка кириллического текста в этом абзаце.
`
	result := renderOk(t, markdown, Options{})

	if result.Title != "Résumé des évolutions" {
		t.Errorf("unexpected title %q", result.Title)
	}
}

func TestRenderLongCodeLine(t *testing.T) {
	markdown := "# Configuration\n\n```yaml\n" +
		strings.Repeat("a", 500) + "\n\tindented: true\n\n" +
		"short: value\n```\n"

	renderOk(t, markdown, Options{})
}

func TestRenderNestedListsInBlockquote(t *testing.T) {
	markdown := `# Checklist

> Quoted intro paragraph.
>
> - First bullet
>   - Nested bullet
>     - Deeply nested bullet
> - Second bullet
>   1. First step
>   2. Second step
>
> - [x] Done item
> - [ ] Pending item

Closing paragraph.
`
	renderOk(t, markdown, Options{})
}

// An ordered list past item 9 needs a wider marker cell than the default
// indent step, or "10." runs into the item text.
func TestRenderOrderedListPastNineItems(t *testing.T) {
	var markdown strings.Builder
	markdown.WriteString("# Procedure\n\n")
	for itemNumber := 1; itemNumber <= 12; itemNumber++ {
		fmt.Fprintf(&markdown, "%d. Step %d of the procedure\n", itemNumber, itemNumber)
	}
	renderOk(t, markdown.String(), Options{})
}

func TestRenderLinkWithEmptyText(t *testing.T) {
	result := renderOk(t, "# Reference\n\nSee [](https://example.com) for details.\n", Options{})

	if !bytes.Contains(result.PDF, []byte("/URI (https://example.com)")) {
		t.Error("a link with no text should still be annotated with its destination")
	}
}

func TestRenderImagesAndRawHtml(t *testing.T) {
	markdown := `# Assets

![A neutral placeholder](https://example.com/chart.png)

<div class="banner">Raw block html</div>

A paragraph with <em>raw inline html</em> in it.
`
	renderOk(t, markdown, Options{})
}

func TestRenderEmojiDoesNotPanic(t *testing.T) {
	// fpdf's width table stops at the basic multilingual plane and indexes it
	// unguarded, so an unsanitized emoji would panic mid-render.
	renderOk(t, "# Status\n\nShipped \U0001F600 and measured \U0001F4CA.\n", Options{})
}

func TestResolveTitle(t *testing.T) {
	const withHeading = "# Heading title\n\nBody text.\n"
	const withoutHeading = "## Only a level two heading\n\nBody text.\n"

	testCases := []struct {
		name     string
		explicit string
		markdown string
		fileName string
		want     string
	}{
		{
			name:     "explicit title wins over the first heading",
			explicit: "Explicit title",
			markdown: withHeading,
			fileName: "notes.md",
			want:     "Explicit title",
		},
		{
			name:     "first level one heading wins over the file name",
			markdown: withHeading,
			fileName: "notes.md",
			want:     "Heading title",
		},
		{
			name:     "file name is the last resort",
			markdown: withoutHeading,
			fileName: "notes.md",
			want:     "notes.md",
		},
		{
			name:     "no title at all",
			markdown: withoutHeading,
			want:     "",
		},
	}
	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			source := []byte(testCase.markdown)
			document := parseMarkdown(source)

			got := ResolveTitle(testCase.explicit, document, source, testCase.fileName)

			if got != testCase.want {
				t.Errorf("ResolveTitle returned %q, want %q", got, testCase.want)
			}
			result := renderOk(t, testCase.markdown, Options{
				Title:    testCase.explicit,
				FileName: testCase.fileName,
			})
			if result.Title != testCase.want {
				t.Errorf("Render resolved the title to %q, want %q", result.Title, testCase.want)
			}
		})
	}
}

func TestRenderCancelledContext(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	_, err := Render(ctx, []byte(longMarkdown(10)), Options{})

	if !errors.Is(err, context.Canceled) {
		t.Fatalf("expected an error wrapping context.Canceled, got %v", err)
	}
}

func parseMarkdown(source []byte) ast.Node {
	return goldmark.New(goldmark.WithExtensions(extension.GFM)).
		Parser().Parse(text.NewReader(source))
}
