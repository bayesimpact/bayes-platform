// Package mdpdf renders Markdown (CommonMark plus GitHub tables, task lists
// and strikethrough) to a paginated A4 PDF. It is pure Go with embedded
// fonts: no headless browser, no font files on disk, no network access.
package mdpdf

import (
	"bytes"
	"context"
	"errors"
	"fmt"

	"codeberg.org/go-pdf/fpdf"
	"github.com/yuin/goldmark"
	"github.com/yuin/goldmark/ast"
	"github.com/yuin/goldmark/extension"
	"github.com/yuin/goldmark/text"
)

// ErrTooManyPages is returned when the rendered document would exceed
// Options.MaxPages.
var ErrTooManyPages = errors.New("pdf export exceeds the page limit")

// Options tunes a single render.
type Options struct {
	Title    string // explicit title, may be empty
	FileName string // last-resort title
	MaxPages int    // 0 means unlimited
}

// Result is a rendered document.
type Result struct {
	PDF       []byte
	PageCount int
	Title     string // resolved title
}

// Page geometry, in millimetres.
const (
	marginLeft   = 20.0
	marginRight  = 20.0
	marginTop    = 18.0
	marginBottom = 20.0
)

// Typography. Sizes are points, heights and spacings millimetres.
const (
	bodyFontSize = 11.0
	codeFontSize = 9.5
	titleSize    = 22.0
	bodyLineH    = 5.5
	// paragraphGap separates block-level nodes.
	paragraphGap = 2.0
	// listIndent is the horizontal step per list or quote level.
	listIndent  = 6.0
	quoteIndent = 6.0
)

// lineHeightFor keeps the ratio of the body font (11 pt over 5.5 mm) at any
// size, so headings and code get proportional leading.
func lineHeightFor(fontSize float64) float64 {
	return fontSize * 0.5
}

var (
	headingSizes    = [6]float64{20, 16, 14, 12.5, 11.5, 11}
	headingSpacings = [6]float64{6, 4, 3, 2, 2, 2}
)

// rgb is a colour in fpdf's 0-255 component space.
type rgb struct {
	red, green, blue int
}

// Colours.
var (
	codeFillColor   = rgb{245, 245, 245}
	quoteBarColor   = rgb{200, 200, 200}
	linkColor       = rgb{26, 86, 187}
	ruleColor       = rgb{200, 200, 200}
	tableBorder     = rgb{180, 180, 180}
	tableHeaderFill = rgb{238, 238, 238}
	footerColor     = rgb{130, 130, 130}
	bodyColor       = rgb{0, 0, 0}
)

// Render converts markdown to a PDF. It reports ErrTooManyPages when the
// document is longer than opts.MaxPages, and wraps ctx.Err() when the context
// ends mid-render.
func Render(ctx context.Context, markdown []byte, opts Options) (Result, error) {
	if err := ctx.Err(); err != nil {
		return Result{}, fmt.Errorf("render markdown to pdf: %w", err)
	}

	parser := goldmark.New(goldmark.WithExtensions(extension.GFM)).Parser()
	document := parser.Parse(text.NewReader(markdown))

	firstHeading := firstLevel1Heading(document, markdown)
	title := ResolveTitle(opts.Title, document, markdown, opts.FileName)
	// The first H1 renders itself as a heading, so a title taken from it must
	// not be repeated as a title line.
	titleFromHeading := opts.Title == "" && firstHeading != ""

	pdf := fpdf.New("P", "mm", "A4", "")
	if err := registerFonts(pdf); err != nil {
		return Result{}, err
	}
	pdf.SetTitle(title, true)
	pdf.SetCreator("pdf-converter", true)
	pdf.SetMargins(marginLeft, marginTop, marginRight)
	pdf.SetAutoPageBreak(true, marginBottom)
	pdf.AliasNbPages("{nb}")
	setFooter(pdf)
	pdf.AddPage()

	renderer := newRenderer(ctx, pdf, markdown, opts)
	if title != "" && !titleFromHeading {
		renderer.writeTitleLine(title)
	}
	if err := renderer.render(document); err != nil {
		return Result{}, err
	}

	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		return Result{}, fmt.Errorf("write pdf: %w", err)
	}
	return Result{PDF: buf.Bytes(), PageCount: pdf.PageCount(), Title: title}, nil
}

// ResolveTitle picks the document title: an explicit title wins, then the
// first level-1 heading, then the file name.
func ResolveTitle(explicit string, doc ast.Node, source []byte, fileName string) string {
	if explicit != "" {
		return explicit
	}
	if heading := firstLevel1Heading(doc, source); heading != "" {
		return heading
	}
	return fileName
}

// firstLevel1Heading returns the flattened text of the first top-level H1, or
// an empty string when the document has none.
func firstLevel1Heading(doc ast.Node, source []byte) string {
	if doc == nil {
		return ""
	}
	for child := doc.FirstChild(); child != nil; child = child.NextSibling() {
		heading, isHeading := child.(*ast.Heading)
		if isHeading && heading.Level == 1 {
			return flattenText(heading, source)
		}
	}
	return ""
}

// setFooter centres "Page N / total" on every page. It deliberately uses a
// core font: the {nb} placeholder is substituted in the raw page stream after
// layout, which UTF-8 fonts encode per glyph and would garble.
func setFooter(pdf *fpdf.Fpdf) {
	pdf.SetFooterFunc(func() {
		pdf.SetY(-15)
		pdf.SetFont("Helvetica", "", 8)
		pdf.SetTextColor(footerColor.red, footerColor.green, footerColor.blue)
		label := fmt.Sprintf("Page %d / {nb}", pdf.PageNo())
		pdf.CellFormat(0, 10, label, "", 0, "C", false, 0, "")
	})
}
