// pdf-converter: GCS-native PDF -> PNG page rasterizer for image-only LLMs,
// plus an MCP endpoint that exports markdown as a downloadable PDF.
// Auth is Cloud Run invoker IAM (no in-app auth).
package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

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
			log.Fatalf("invalid PDF_EXPORT_TTL_MINUTES: %q exceeds the %d minute GCS signing limit",
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

	client, err := storage.NewClient(context.Background())
	if err != nil {
		log.Fatalf("gcs client: %v", err)
	}
	renderer, err := render.NewRenderer()
	if err != nil {
		log.Fatalf("renderer: %v", err)
	}

	server := newServer(&gcsStore{bucket: client.Bucket(bucketName)}, renderer, maxSourceBytes, renderTimeout, exportCfg)
	log.Printf("pdf-converter listening on :%s (bucket %s)", port, bucketName)
	log.Fatal(http.ListenAndServe(":"+port, server))
}
