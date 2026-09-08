package mdpdf

import (
	"cmp"
	"slices"
	"strings"

	"github.com/yuin/goldmark/ast"
	extast "github.com/yuin/goldmark/extension/ast"
)

const (
	// tableCellPad is the inner padding of every cell, in millimetres.
	tableCellPad = 1.5
	// tableMinColWidth keeps narrow columns readable.
	tableMinColWidth = 15.0
	// maxTableColumns is the widest grid that still fits an A4 page; beyond
	// it the table degrades to plain "a | b | c" lines.
	maxTableColumns = 8
)

// tableCell is one cell flattened to plain text.
type tableCell struct {
	text string
	// align is an fpdf alignment string: "L", "C" or "R".
	align string
}

type tableRow struct {
	cells  []tableCell
	header bool
}

// renderTable paints a GFM table. Cells are flattened to plain text: inline
// markup inside a cell is not worth a nested layout pass.
func (renderer *renderer) renderTable(table *extast.Table) {
	rows := renderer.collectTableRows(table)
	columns := 0
	for _, row := range rows {
		columns = max(columns, len(row.cells))
	}
	if columns == 0 {
		return
	}

	renderer.addGap(paragraphGap)
	if columns > maxTableColumns {
		renderer.writeTableAsText(rows)
		return
	}

	widths := renderer.columnWidths(rows, columns)
	var header *tableRow
	if rows[0].header {
		header = &rows[0]
	}
	for rowIndex := range rows {
		renderer.drawTableRow(&rows[rowIndex], widths, header)
	}
	renderer.applyStyle()
	renderer.addGap(paragraphGap)
}

// collectTableRows flattens the header and every body row, in document order.
func (renderer *renderer) collectTableRows(table *extast.Table) []tableRow {
	var rows []tableRow
	for child := table.FirstChild(); child != nil; child = child.NextSibling() {
		switch child.(type) {
		case *extast.TableHeader:
			rows = append(rows, renderer.collectTableRow(child, true))
		case *extast.TableRow:
			rows = append(rows, renderer.collectTableRow(child, false))
		}
	}
	return rows
}

func (renderer *renderer) collectTableRow(row ast.Node, header bool) tableRow {
	collected := tableRow{header: header}
	for child := row.FirstChild(); child != nil; child = child.NextSibling() {
		cell, isCell := child.(*extast.TableCell)
		if !isCell {
			continue
		}
		collected.cells = append(collected.cells, tableCell{
			text:  sanitizeText(flattenText(cell, renderer.source)),
			align: cellAlignment(cell.Alignment),
		})
	}
	return collected
}

func cellAlignment(alignment extast.Alignment) string {
	switch alignment {
	case extast.AlignCenter:
		return "C"
	case extast.AlignRight:
		return "R"
	default:
		return "L"
	}
}

// columnWidths sizes every column to its widest cell, then fits the set to
// the available text width.
func (renderer *renderer) columnWidths(rows []tableRow, columns int) []float64 {
	// A cell's text is inset by the padding and, inside that, by fpdf's own
	// cell margin; both have to be added to the natural text width.
	inset := 2*tableCellPad + 2*renderer.pdf.GetCellMargin()
	natural := make([]float64, columns)
	for _, row := range rows {
		renderer.setTableFont(row.header)
		for columnIndex, cell := range row.cells {
			natural[columnIndex] = max(natural[columnIndex],
				renderer.pdf.GetStringWidth(cell.text)+inset)
		}
	}
	for columnIndex := range natural {
		natural[columnIndex] = max(tableMinColWidth, natural[columnIndex])
	}
	return fitColumns(natural, renderer.textWidth())
}

// fitColumns scales natural column widths to the available width. Too narrow
// a set is grown proportionally; too wide a set keeps the columns that fit
// their fair share and splits what is left equally among the wide ones, so a
// single long column cannot starve the others down to one character per line.
func fitColumns(natural []float64, available float64) []float64 {
	widths := make([]float64, len(natural))
	copy(widths, natural)
	total := 0.0
	for _, width := range widths {
		total += width
	}
	if total <= 0 {
		return widths
	}
	if total <= available {
		for columnIndex := range widths {
			widths[columnIndex] *= available / total
		}
		return widths
	}

	narrowestFirst := make([]int, len(widths))
	for columnIndex := range narrowestFirst {
		narrowestFirst[columnIndex] = columnIndex
	}
	slices.SortStableFunc(narrowestFirst, func(left, right int) int {
		return cmp.Compare(widths[left], widths[right])
	})
	remaining := available
	for position, columnIndex := range narrowestFirst {
		share := remaining / float64(len(narrowestFirst)-position)
		if widths[columnIndex] <= share {
			remaining -= widths[columnIndex]
			continue
		}
		// This column and every wider one exceed the fair share: they all
		// take an equal slice of what is left.
		for _, wideIndex := range narrowestFirst[position:] {
			widths[wideIndex] = share
		}
		break
	}
	return widths
}

// drawTableRow wraps every cell, draws the row's borders and text, and leaves
// the cursor on the row below. When the row does not fit, it starts a new
// page and repeats the header there.
func (renderer *renderer) drawTableRow(row *tableRow, widths []float64, header *tableRow) {
	renderer.setTableFont(row.header)
	lineHeight := lineHeightFor(bodyFontSize)

	wrapped := make([][]string, len(widths))
	lineCount := 1
	for columnIndex, width := range widths {
		text := ""
		if columnIndex < len(row.cells) {
			text = row.cells[columnIndex].text
		}
		lines := renderer.pdf.SplitText(text, width-2*tableCellPad)
		if len(lines) == 0 {
			lines = []string{""}
		}
		wrapped[columnIndex] = lines
		lineCount = max(lineCount, len(lines))
	}
	rowHeight := float64(lineCount)*lineHeight + 2*tableCellPad

	// The height check is skipped at the top of a page: a row taller than the
	// text area would otherwise add blank pages forever.
	if renderer.pdf.GetY()+rowHeight > renderer.breakTrigger() && renderer.pdf.GetY() > marginTop {
		renderer.pdf.AddPage()
		if header != nil && !row.header {
			renderer.drawTableRow(header, widths, nil)
			renderer.setTableFont(row.header)
		}
	}

	// Cells are positioned by hand, so fpdf must not break the page midway.
	renderer.pdf.SetAutoPageBreak(false, marginBottom)
	renderer.setFillColor(tableHeaderFill)
	renderer.setDrawColor(tableBorder)
	renderer.pdf.SetLineWidth(0.2)
	borderStyle := "D"
	if row.header {
		borderStyle = "DF"
	}
	top := renderer.pdf.GetY()
	cellLeft := renderer.leftEdge()
	for columnIndex, width := range widths {
		renderer.pdf.Rect(cellLeft, top, width, rowHeight, borderStyle)
		align := "L"
		if columnIndex < len(row.cells) {
			align = row.cells[columnIndex].align
		}
		for lineIndex, line := range wrapped[columnIndex] {
			renderer.pdf.SetXY(cellLeft+tableCellPad, top+tableCellPad+float64(lineIndex)*lineHeight)
			renderer.pdf.CellFormat(width-2*tableCellPad, lineHeight, line,
				"", 0, align, false, 0, "")
		}
		cellLeft += width
	}
	renderer.setDrawColor(bodyColor)
	renderer.pdf.SetLineWidth(renderer.baseLineWidth)
	renderer.pdf.SetAutoPageBreak(true, marginBottom)
	renderer.pdf.SetXY(renderer.leftEdge(), top+rowHeight)
}

// setTableFont selects the body font, bold for header rows.
func (renderer *renderer) setTableFont(header bool) {
	style := ""
	if header {
		style = "B"
	}
	renderer.pdf.SetFont(bodyFamily, style, bodyFontSize)
}

// writeTableAsText is the fallback for tables too wide to draw as a grid.
func (renderer *renderer) writeTableAsText(rows []tableRow) {
	for _, row := range rows {
		texts := make([]string, 0, len(row.cells))
		for _, cell := range row.cells {
			texts = append(texts, cell.text)
		}
		renderer.pushStyle(func(style *textStyle) { style.bold = row.header })
		renderer.writeText(strings.Join(texts, " | "))
		renderer.pdf.Ln(lineHeightFor(bodyFontSize))
		renderer.popStyle()
	}
	renderer.addGap(paragraphGap)
}
