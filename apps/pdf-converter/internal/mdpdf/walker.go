package mdpdf

import (
	"context"
	"fmt"
	"strings"

	"codeberg.org/go-pdf/fpdf"
	"github.com/yuin/goldmark/ast"
	extast "github.com/yuin/goldmark/extension/ast"
)

// fpdf's UTF-8 character-width table covers the basic multilingual plane
// only, and its flowing writer indexes that table unguarded: a rune above it
// (emoji, mostly) panics inside fpdf. Such runes are replaced before writing.
const maxSupportedRune = 0xFFFF

// bulletMarkers are the unordered-list markers by nesting depth.
var bulletMarkers = []string{"•", "–", "▪"}

// Task-list markers. GitHub draws a task item with its checkbox in place of
// the bullet, so these are used as the marker rather than written inline.
const (
	uncheckedMarker = "☐"
	checkedMarker   = "☑"
)

// textStyle is the inline formatting in effect.
type textStyle struct {
	bold, italic, strike, mono bool
	size                       float64
}

// listFrame tracks one open list level.
type listFrame struct {
	ordered bool
	next    int
	// markerWidth is the width of the marker cell for every item of this list.
	// An ordered list measures its widest marker upfront, so "100." does not
	// run into the item text and all the item bodies line up.
	markerWidth float64
}

// quoteMark records where a blockquote started, so its left bar can be drawn
// once the quote closes.
type quoteMark struct {
	page int
	y    float64
}

// renderer walks a markdown AST and paints it onto one fpdf document.
type renderer struct {
	ctx    context.Context
	pdf    *fpdf.Fpdf
	source []byte
	opts   Options

	// styles is a stack; its last entry is the formatting in effect.
	styles []textStyle
	// indent is the current horizontal offset from the left margin.
	indent float64
	// lists holds one frame per open list, innermost last.
	lists []listFrame
	// link is the destination of the link being written, if any.
	link string
	// markerCheckBox is the task checkbox already drawn as a list marker, so
	// the walk does not write it a second time inside the item text.
	markerCheckBox *extast.TaskCheckBox
	// quotes holds one mark per open blockquote, innermost last.
	quotes []quoteMark
	// baseLineWidth is the document default, restored after drawing rules.
	baseLineWidth float64
	// err is the first failure seen; the walk stops as soon as it is set.
	err error
}

func newRenderer(ctx context.Context, pdf *fpdf.Fpdf, source []byte, opts Options) *renderer {
	renderer := &renderer{
		ctx:           ctx,
		pdf:           pdf,
		source:        source,
		opts:          opts,
		styles:        []textStyle{{size: bodyFontSize}},
		baseLineWidth: pdf.GetLineWidth(),
	}
	renderer.applyStyle()
	return renderer
}

// render walks the whole document. It returns ErrTooManyPages, a wrapped
// context error, or a wrapped fpdf error.
func (renderer *renderer) render(document ast.Node) error {
	if err := ast.Walk(document, renderer.visit); err != nil {
		return err
	}
	if renderer.err != nil {
		return renderer.err
	}
	if err := renderer.pdf.Error(); err != nil {
		return fmt.Errorf("build pdf: %w", err)
	}
	return nil
}

func (renderer *renderer) visit(node ast.Node, entering bool) (ast.WalkStatus, error) {
	if entering {
		return renderer.enter(node)
	}
	renderer.leave(node)
	if node.Type() == ast.TypeBlock {
		if err := renderer.checkLimits(); err != nil {
			return ast.WalkStop, err
		}
	}
	return ast.WalkContinue, nil
}

// checkLimits enforces the page cap and the caller's context after each block.
func (renderer *renderer) checkLimits() error {
	if err := renderer.ctx.Err(); err != nil {
		renderer.err = fmt.Errorf("render markdown to pdf: %w", err)
		return renderer.err
	}
	if renderer.opts.MaxPages > 0 && renderer.pdf.PageNo() > renderer.opts.MaxPages {
		renderer.err = fmt.Errorf("%w: page %d of at most %d",
			ErrTooManyPages, renderer.pdf.PageNo(), renderer.opts.MaxPages)
		return renderer.err
	}
	if err := renderer.pdf.Error(); err != nil {
		renderer.err = fmt.Errorf("build pdf: %w", err)
		return renderer.err
	}
	return nil
}

func (renderer *renderer) enter(node ast.Node) (ast.WalkStatus, error) {
	switch typed := node.(type) {
	case *ast.Heading:
		renderer.beginHeading(typed)
	case *ast.Text:
		renderer.writeText(string(typed.Segment.Value(renderer.source)))
		switch {
		case typed.HardLineBreak():
			renderer.pdf.Ln(lineHeightFor(renderer.style().size))
		case typed.SoftLineBreak():
			renderer.writeText(" ")
		}
		return ast.WalkSkipChildren, nil
	case *ast.String:
		renderer.writeText(string(typed.Value))
		return ast.WalkSkipChildren, nil
	case *ast.Emphasis:
		renderer.pushStyle(func(style *textStyle) {
			if typed.Level >= 2 {
				style.bold = true
				return
			}
			style.italic = true
		})
	case *extast.Strikethrough:
		renderer.pushStyle(func(style *textStyle) { style.strike = true })
	case *ast.CodeSpan:
		renderer.pushStyle(func(style *textStyle) {
			style.mono = true
			style.size = codeFontSize
		})
	case *ast.Link:
		// The style itself does not change, but pushing a frame re-applies it
		// with the link colour and underline, and pops symmetrically on exit.
		renderer.link = string(typed.Destination)
		renderer.pushStyle(func(*textStyle) {})
		if flattenText(typed, renderer.source) == "" {
			// `[](https://example.com)` carries no text; writing the
			// destination keeps the link visible and clickable instead of
			// rendering nothing at all.
			renderer.writeText(renderer.link)
			return ast.WalkSkipChildren, nil
		}
	case *ast.AutoLink:
		renderer.writeLink(string(typed.URL(renderer.source)), string(typed.URL(renderer.source)))
		return ast.WalkSkipChildren, nil
	case *ast.Image:
		// Images are never fetched: the PDF is built offline. The alt text
		// and the URL are written instead, so nothing is silently lost.
		renderer.pushStyle(func(style *textStyle) { style.italic = true })
		renderer.writeText(fmt.Sprintf("[%s](%s)",
			flattenText(typed, renderer.source), string(typed.Destination)))
		renderer.popStyle()
		return ast.WalkSkipChildren, nil
	case *ast.RawHTML, *ast.HTMLBlock:
		// Raw HTML is dropped rather than rendered as markup noise.
		return ast.WalkSkipChildren, nil
	case *ast.FencedCodeBlock, *ast.CodeBlock:
		renderer.writeCodeBlock(node)
		return ast.WalkSkipChildren, nil
	case *ast.Blockquote:
		renderer.beginQuote()
	case *ast.List:
		renderer.lists = append(renderer.lists, renderer.newListFrame(typed))
	case *ast.ListItem:
		renderer.beginListItem(typed)
	case *extast.TaskCheckBox:
		if typed == renderer.markerCheckBox {
			// Already drawn in place of the bullet by beginListItem.
			return ast.WalkSkipChildren, nil
		}
		renderer.writeText(taskMarker(typed) + " ")
		return ast.WalkSkipChildren, nil
	case *ast.ThematicBreak:
		renderer.drawRule()
		return ast.WalkSkipChildren, nil
	case *extast.Table:
		renderer.renderTable(typed)
		return ast.WalkSkipChildren, nil
	}
	return ast.WalkContinue, nil
}

func (renderer *renderer) leave(node ast.Node) {
	switch node.(type) {
	case *ast.Heading:
		renderer.pdf.Ln(lineHeightFor(renderer.style().size))
		renderer.popStyle()
		renderer.addGap(paragraphGap)
	case *ast.Paragraph:
		renderer.pdf.Ln(lineHeightFor(bodyFontSize))
		renderer.addGap(paragraphGap)
	case *ast.TextBlock:
		renderer.pdf.Ln(lineHeightFor(bodyFontSize))
	case *ast.Emphasis, *ast.CodeSpan, *extast.Strikethrough:
		renderer.popStyle()
	case *ast.Link:
		renderer.link = ""
		renderer.popStyle()
	case *ast.Blockquote:
		renderer.endQuote()
	case *ast.List:
		if len(renderer.lists) > 0 {
			renderer.lists = renderer.lists[:len(renderer.lists)-1]
		}
		if len(renderer.lists) == 0 {
			renderer.addGap(paragraphGap)
		}
	case *ast.ListItem:
		renderer.setIndent(renderer.indent - renderer.markerWidth())
	}
}

// Style handling.

func (renderer *renderer) style() textStyle {
	return renderer.styles[len(renderer.styles)-1]
}

// pushStyle saves the current style and applies mutate to a copy of it.
func (renderer *renderer) pushStyle(mutate func(style *textStyle)) {
	style := renderer.style()
	mutate(&style)
	renderer.styles = append(renderer.styles, style)
	renderer.applyStyle()
}

func (renderer *renderer) popStyle() {
	if len(renderer.styles) > 1 {
		renderer.styles = renderer.styles[:len(renderer.styles)-1]
	}
	renderer.applyStyle()
}

// applyStyle selects the font and text colour for the current style. Only
// the regular weight of the mono family is embedded, so bold and italic are
// ignored there.
func (renderer *renderer) applyStyle() {
	style := renderer.style()
	family := bodyFamily
	fontStyle := ""
	if style.mono {
		family = monoFamily
	} else {
		if style.bold {
			fontStyle += "B"
		}
		if style.italic {
			fontStyle += "I"
		}
	}
	if style.strike {
		// fpdf draws the strike per cell, so a span that wraps stays struck.
		fontStyle += "S"
	}
	if renderer.link != "" {
		fontStyle += "U"
	}
	renderer.pdf.SetFont(family, fontStyle, style.size)
	if renderer.link != "" {
		renderer.setTextColor(linkColor)
		return
	}
	renderer.setTextColor(bodyColor)
}

func (renderer *renderer) setTextColor(color rgb) {
	renderer.pdf.SetTextColor(color.red, color.green, color.blue)
}

func (renderer *renderer) setFillColor(color rgb) {
	renderer.pdf.SetFillColor(color.red, color.green, color.blue)
}

func (renderer *renderer) setDrawColor(color rgb) {
	renderer.pdf.SetDrawColor(color.red, color.green, color.blue)
}

// Geometry helpers.

// setIndent moves the left margin so wrapped lines line up with the block.
func (renderer *renderer) setIndent(indent float64) {
	if indent < 0 {
		indent = 0
	}
	renderer.indent = indent
	renderer.pdf.SetLeftMargin(marginLeft + indent)
}

func (renderer *renderer) leftEdge() float64 {
	return marginLeft + renderer.indent
}

func (renderer *renderer) textWidth() float64 {
	pageWidth, _ := renderer.pdf.GetPageSize()
	return pageWidth - marginRight - renderer.leftEdge()
}

// breakTrigger is the y beyond which fpdf starts a new page.
func (renderer *renderer) breakTrigger() float64 {
	_, pageHeight := renderer.pdf.GetPageSize()
	return pageHeight - marginBottom
}

// addGap advances past vertical whitespace and returns to the left margin.
func (renderer *renderer) addGap(gap float64) {
	renderer.pdf.SetY(renderer.pdf.GetY() + gap)
}

// Inline writing.

// writeText writes flowing text in the current style, wrapping at the right
// margin and continuing at the current left margin. Inside a link it emits a
// real PDF link annotation.
func (renderer *renderer) writeText(content string) {
	if content == "" {
		return
	}
	lineHeight := lineHeightFor(renderer.style().size)
	sanitized := sanitizeText(content)
	if renderer.link != "" {
		renderer.pdf.WriteLinkString(lineHeight, sanitized, renderer.link)
		return
	}
	renderer.pdf.Write(lineHeight, sanitized)
}

// writeLink writes a self-contained clickable link, for autolinks whose text
// is the URL itself.
func (renderer *renderer) writeLink(label, target string) {
	renderer.link = target
	renderer.applyStyle()
	renderer.writeText(label)
	renderer.link = ""
	renderer.applyStyle()
}

// Block writing.

// writeTitleLine writes the document title above the body. It is only used
// when the title did not come from the first heading, which renders itself.
func (renderer *renderer) writeTitleLine(title string) {
	renderer.pushStyle(func(style *textStyle) {
		style.bold = true
		style.size = titleSize
	})
	renderer.writeText(title)
	renderer.pdf.Ln(lineHeightFor(titleSize))
	renderer.popStyle()
	renderer.addGap(2 * paragraphGap)
}

// beginHeading spaces the heading from the previous block and keeps it with
// the text that follows.
func (renderer *renderer) beginHeading(heading *ast.Heading) {
	level := min(max(heading.Level, 1), len(headingSizes))
	fontSize := headingSizes[level-1]
	lineHeight := lineHeightFor(fontSize)
	if renderer.pdf.GetY() > marginTop {
		renderer.addGap(headingSpacings[level-1])
	}
	if renderer.pdf.GetY()+3*lineHeight > renderer.breakTrigger() {
		renderer.pdf.AddPage()
	}
	renderer.pushStyle(func(style *textStyle) {
		style.bold = true
		style.size = fontSize
	})
	renderer.pdf.SetX(renderer.leftEdge())
}

// writeCodeBlock paints one filled monospaced line per (wrapped) source line.
func (renderer *renderer) writeCodeBlock(node ast.Node) {
	renderer.addGap(paragraphGap)
	renderer.pushStyle(func(style *textStyle) {
		style.mono = true
		style.size = codeFontSize
	})
	lineHeight := lineHeightFor(codeFontSize)
	width := renderer.textWidth()
	renderer.setFillColor(codeFillColor)
	lines := node.Lines()
	for lineIndex := 0; lineIndex < lines.Len(); lineIndex++ {
		segment := lines.At(lineIndex)
		content := strings.TrimRight(string(segment.Value(renderer.source)), "\r\n")
		content = sanitizeText(strings.ReplaceAll(content, "\t", "    "))
		wrapped := renderer.pdf.SplitText(content, width)
		if len(wrapped) == 0 {
			// Preserve blank lines inside the block.
			wrapped = []string{""}
		}
		for _, wrappedLine := range wrapped {
			renderer.pdf.CellFormat(width, lineHeight, wrappedLine, "", 1, "", true, 0, "")
		}
	}
	renderer.popStyle()
	renderer.addGap(paragraphGap)
}

// beginQuote indents the quote and records where its left bar starts.
func (renderer *renderer) beginQuote() {
	renderer.addGap(paragraphGap)
	renderer.quotes = append(renderer.quotes,
		quoteMark{page: renderer.pdf.PageNo(), y: renderer.pdf.GetY()})
	renderer.setIndent(renderer.indent + quoteIndent)
	renderer.pdf.SetX(renderer.leftEdge())
}

// endQuote draws the left bar over the vertical span the quote covered. A
// quote spanning pages only gets a bar on its last page.
func (renderer *renderer) endQuote() {
	if len(renderer.quotes) == 0 {
		return
	}
	start := renderer.quotes[len(renderer.quotes)-1]
	renderer.quotes = renderer.quotes[:len(renderer.quotes)-1]
	barX := renderer.leftEdge() - quoteIndent/2
	renderer.setIndent(renderer.indent - quoteIndent)

	top := start.y
	if start.page != renderer.pdf.PageNo() {
		top = marginTop
	}
	bottom := renderer.pdf.GetY()
	if bottom > top {
		renderer.pdf.SetLineWidth(0.8)
		renderer.setDrawColor(quoteBarColor)
		renderer.pdf.Line(barX, top, barX, bottom)
		renderer.setDrawColor(bodyColor)
		renderer.pdf.SetLineWidth(renderer.baseLineWidth)
	}
	renderer.addGap(paragraphGap)
}

// newListFrame opens a list level and fixes its marker cell width. An ordered
// list measures the widest marker it will draw, so a list running past item 9
// keeps its numbers and its text from overlapping.
func (renderer *renderer) newListFrame(list *ast.List) listFrame {
	frame := listFrame{ordered: list.IsOrdered(), next: list.Start, markerWidth: listIndent}
	if !frame.ordered {
		return frame
	}
	widest := fmt.Sprintf("%d.", list.Start+max(list.ChildCount(), 1)-1)
	frame.markerWidth = max(listIndent, renderer.pdf.GetStringWidth(widest+" "))
	return frame
}

// markerWidth is the marker cell width of the innermost open list, and the
// step the item body is indented by.
func (renderer *renderer) markerWidth() float64 {
	if len(renderer.lists) == 0 {
		return listIndent
	}
	return renderer.lists[len(renderer.lists)-1].markerWidth
}

// taskMarker is the checkbox glyph for a task-list checkbox.
func taskMarker(checkBox *extast.TaskCheckBox) string {
	if checkBox.IsChecked {
		return checkedMarker
	}
	return uncheckedMarker
}

// taskCheckBoxOf returns the checkbox that makes item a task-list item, or nil
// when it is a plain item. The task-list extension puts it first inside the
// item's first block.
func taskCheckBoxOf(item *ast.ListItem) *extast.TaskCheckBox {
	firstBlock := item.FirstChild()
	if firstBlock == nil {
		return nil
	}
	checkBox, isCheckBox := firstBlock.FirstChild().(*extast.TaskCheckBox)
	if !isCheckBox {
		return nil
	}
	return checkBox
}

// beginListItem writes the marker and indents the item body so wrapped lines
// align under the first character rather than under the marker.
func (renderer *renderer) beginListItem(item *ast.ListItem) {
	if len(renderer.lists) == 0 {
		return
	}
	frame := &renderer.lists[len(renderer.lists)-1]
	marker := bulletMarkers[min(len(renderer.lists), len(bulletMarkers))-1]
	checkBox := taskCheckBoxOf(item)
	switch {
	case frame.ordered:
		// An ordered task item keeps its number; its checkbox is written
		// inline, right before the item text.
		marker = fmt.Sprintf("%d.", frame.next)
		frame.next++
	case checkBox != nil:
		// GitHub replaces the bullet of a task item with the checkbox itself.
		marker = taskMarker(checkBox)
		renderer.markerCheckBox = checkBox
	}
	markerLeft := renderer.leftEdge()
	renderer.setIndent(renderer.indent + frame.markerWidth)
	renderer.pdf.SetXY(markerLeft, renderer.pdf.GetY())
	renderer.pdf.CellFormat(frame.markerWidth, lineHeightFor(bodyFontSize), marker,
		"", 0, "L", false, 0, "")
}

// drawRule draws a thematic break across the text width.
func (renderer *renderer) drawRule() {
	renderer.addGap(paragraphGap)
	if renderer.pdf.GetY()+paragraphGap > renderer.breakTrigger() {
		renderer.pdf.AddPage()
	}
	ruleY := renderer.pdf.GetY()
	renderer.pdf.SetLineWidth(0.3)
	renderer.setDrawColor(ruleColor)
	renderer.pdf.Line(renderer.leftEdge(), ruleY, renderer.leftEdge()+renderer.textWidth(), ruleY)
	renderer.setDrawColor(bodyColor)
	renderer.pdf.SetLineWidth(renderer.baseLineWidth)
	renderer.addGap(2 * paragraphGap)
}

// Text extraction.

// flattenText concatenates the inline text under node, dropping markup.
func flattenText(node ast.Node, source []byte) string {
	var builder strings.Builder
	appendInlineText(&builder, node, source)
	return strings.TrimSpace(builder.String())
}

func appendInlineText(builder *strings.Builder, node ast.Node, source []byte) {
	for child := node.FirstChild(); child != nil; child = child.NextSibling() {
		switch typed := child.(type) {
		case *ast.Text:
			builder.Write(typed.Segment.Value(source))
			if typed.SoftLineBreak() || typed.HardLineBreak() {
				builder.WriteByte(' ')
			}
		case *ast.String:
			builder.Write(typed.Value)
		case *ast.AutoLink:
			builder.Write(typed.URL(source))
		case *ast.RawHTML, *ast.HTMLBlock:
			// Dropped, like everywhere else.
		default:
			appendInlineText(builder, child, source)
		}
	}
}

// sanitizeText replaces runes fpdf cannot measure with the replacement
// character, keeping a stray emoji from panicking the renderer.
func sanitizeText(content string) string {
	if !strings.ContainsFunc(content, isUnsupportedRune) {
		return content
	}
	return strings.Map(func(symbol rune) rune {
		if isUnsupportedRune(symbol) {
			return '�'
		}
		return symbol
	}, content)
}

func isUnsupportedRune(symbol rune) bool {
	return symbol > maxSupportedRune
}
