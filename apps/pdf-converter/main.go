// pdf-converter: PDF -> PNG page rasterizer for image-only LLMs, reading and
// writing the platform bucket (S3-compatible), plus an MCP endpoint
// that exports markdown as a downloadable PDF.
package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/joho/godotenv"

	"github.com/bayesimpact/bayes-platform/apps/pdf-converter/internal/render"
)

func main() {
	// Local development reads apps/pdf-converter/.env (see .env-example). The
	// file is absent in the image and in production, where this is a no-op;
	// variables already set in the environment always win.
	_ = godotenv.Load()
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
	// Hard per-request rendering deadline: a PDF that hangs pdfium is killed
	// and its pool instance re-created, so it cannot wedge the service. Must
	// stay below the API client's request timeout (120s) so the converter
	// aborts first.
	renderTimeout := 60 * time.Second
	if fromEnv := os.Getenv("PDF_CONVERTER_RENDER_TIMEOUT_MS"); fromEnv != "" {
		parsed, err := strconv.ParseInt(fromEnv, 10, 64)
		if err != nil || parsed <= 0 {
			log.Fatalf("invalid PDF_CONVERTER_RENDER_TIMEOUT_MS: %q", fromEnv)
		}
		renderTimeout = time.Duration(parsed) * time.Millisecond
	}
	// Separate deadline for signing and uploading an exported PDF, so a
	// render that used most of renderTimeout still gets a full upload budget.
	// renderTimeout + uploadTimeout must stay below the API client's request
	// timeout (120s) for the same reason as above.
	uploadTimeout := 30 * time.Second
	if fromEnv := os.Getenv("PDF_CONVERTER_UPLOAD_TIMEOUT_MS"); fromEnv != "" {
		parsed, err := strconv.ParseInt(fromEnv, 10, 64)
		if err != nil || parsed <= 0 {
			log.Fatalf("invalid PDF_CONVERTER_UPLOAD_TIMEOUT_MS: %q", fromEnv)
		}
		uploadTimeout = time.Duration(parsed) * time.Millisecond
	}

	exportTTL := 15 * time.Minute
	if fromEnv := os.Getenv("PDF_EXPORT_TTL_MINUTES"); fromEnv != "" {
		parsed, err := strconv.Atoi(fromEnv)
		if err != nil || parsed <= 0 {
			log.Fatalf("invalid PDF_EXPORT_TTL_MINUTES: %q", fromEnv)
		}
		if parsed > maxPdfExportTTLMinutes {
			log.Fatalf("invalid PDF_EXPORT_TTL_MINUTES: %q exceeds the %d minute SigV4 signing limit",
				fromEnv, maxPdfExportTTLMinutes)
		}
		exportTTL = time.Duration(parsed) * time.Minute
	}
	maxMarkdownBytes := 1 << 20
	if fromEnv := os.Getenv("PDF_EXPORT_MAX_MARKDOWN_BYTES"); fromEnv != "" {
		parsed, err := strconv.Atoi(fromEnv)
		if err != nil || parsed <= 0 {
			log.Fatalf("invalid PDF_EXPORT_MAX_MARKDOWN_BYTES: %q", fromEnv)
		}
		maxMarkdownBytes = parsed
	}
	exportTmpPrefix := defaultPdfExportPrefix
	if fromEnv := os.Getenv("PDF_EXPORT_TMP_PREFIX"); fromEnv != "" {
		exportTmpPrefix = fromEnv
	}
	if !validObjectPath(exportTmpPrefix) || !strings.HasSuffix(exportTmpPrefix, "/") {
		log.Fatalf("invalid PDF_EXPORT_TMP_PREFIX: %q must be a relative object path ending with /", exportTmpPrefix)
	}
	exportCfg := pdfExportConfig{
		TTL:              exportTTL,
		MaxMarkdownBytes: maxMarkdownBytes,
		TmpPrefix:        exportTmpPrefix,
		Timeout:          renderTimeout,
		UploadTimeout:    uploadTimeout,
		MaxPages:         pdfExportMaxPages,
	}

	store, description := newObjectStore(context.Background())
	renderer, err := render.NewRenderer()
	if err != nil {
		log.Fatalf("renderer: %v", err)
	}

	server := newServer(store, renderer, maxSourceBytes, renderTimeout, exportCfg)
	log.Printf("pdf-converter listening on :%s (%s)", port, description)
	log.Fatal(http.ListenAndServe(":"+port, server))
}

// newObjectStore reads the same variables as the API. A Cloud Storage bucket is
// reached through its S3 API, with HMAC keys.
func newObjectStore(ctx context.Context) (objectStore, string) {
	if backend := os.Getenv("STORAGE_BACKEND"); backend != "s3" {
		log.Fatalf("STORAGE_BACKEND must be s3, got %q: the converter needs a bucket (see .env-example)", backend)
	}
	settings := s3Settings{
		Bucket:          os.Getenv("S3_BUCKET"),
		Endpoint:        os.Getenv("S3_ENDPOINT"),
		PublicEndpoint:  os.Getenv("S3_PUBLIC_ENDPOINT"),
		Region:          os.Getenv("S3_REGION"),
		AccessKeyID:     os.Getenv("S3_ACCESS_KEY_ID"),
		SecretAccessKey: os.Getenv("S3_SECRET_ACCESS_KEY"),
		ForcePathStyle:  os.Getenv("S3_FORCE_PATH_STYLE") == "true",
	}
	if settings.Bucket == "" {
		log.Fatal("S3_BUCKET is required (see .env-example)")
	}
	store, err := newS3Store(ctx, settings)
	if err != nil {
		log.Fatalf("s3 client: %v", err)
	}
	return store, "s3 bucket " + settings.Bucket
}
