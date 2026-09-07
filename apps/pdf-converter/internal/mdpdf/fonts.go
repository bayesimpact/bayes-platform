package mdpdf

import (
	"embed"
	"fmt"
	"sync"

	"codeberg.org/go-pdf/fpdf"
)

// The DejaVu fonts (release 2.37, LICENSE in fonts/) are embedded so the
// distroless binary needs no font files on disk and no network access.
//
//go:embed fonts/*.ttf
var fontFiles embed.FS

const (
	// bodyFamily is the proportional family used for prose.
	bodyFamily = "DejaVu"
	// monoFamily is the fixed-width family used for code.
	monoFamily = "DejaVuMono"
)

// fontVariant pairs an fpdf style string with its embedded TTF.
type fontVariant struct {
	family string
	style  string
	path   string
}

var fontVariants = []fontVariant{
	{family: bodyFamily, style: "", path: "fonts/DejaVuSans.ttf"},
	{family: bodyFamily, style: "B", path: "fonts/DejaVuSans-Bold.ttf"},
	{family: bodyFamily, style: "I", path: "fonts/DejaVuSans-Oblique.ttf"},
	{family: bodyFamily, style: "BI", path: "fonts/DejaVuSans-BoldOblique.ttf"},
	{family: monoFamily, style: "", path: "fonts/DejaVuSansMono.ttf"},
}

var (
	loadFontsOnce sync.Once
	loadedFonts   [][]byte
	loadFontsErr  error
)

// loadFonts reads the embedded TTFs once; every render reuses the same bytes.
func loadFonts() ([][]byte, error) {
	loadFontsOnce.Do(func() {
		loadedFonts = make([][]byte, len(fontVariants))
		for variantIndex, variant := range fontVariants {
			data, err := fontFiles.ReadFile(variant.path)
			if err != nil {
				loadFontsErr = fmt.Errorf("read embedded font %s: %w", variant.path, err)
				return
			}
			loadedFonts[variantIndex] = data
		}
	})
	return loadedFonts, loadFontsErr
}

// registerFonts adds every embedded variant to a fresh document. fpdf keeps
// font state per document, so this runs on every Render.
func registerFonts(pdf *fpdf.Fpdf) error {
	fonts, err := loadFonts()
	if err != nil {
		return err
	}
	for variantIndex, variant := range fontVariants {
		pdf.AddUTF8FontFromBytes(variant.family, variant.style, fonts[variantIndex])
	}
	if err := pdf.Error(); err != nil {
		return fmt.Errorf("register embedded fonts: %w", err)
	}
	return nil
}
