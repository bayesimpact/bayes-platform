package main

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/bayesimpact/bayes-platform/apps/pdf-converter/internal/render"
	"github.com/bayesimpact/bayes-platform/apps/pdf-converter/internal/render/pdftest"
)

type fakeStore struct {
	mutex   sync.Mutex
	objects map[string][]byte
	// contentTypes records the content type each object was uploaded with.
	contentTypes map[string]string
	// customTimes records the ExpiresAt each object was uploaded with (zero
	// when none was set).
	customTimes map[string]time.Time
	// signedDownloadFileNames records the DownloadFileName each SignedURL call
	// was given, keyed by object.
	signedDownloadFileNames map[string]string
	// signErr, when set, makes SignedURL fail.
	signErr error
}

func (store *fakeStore) Download(ctx context.Context, object string, maxBytes int64) ([]byte, error) {
	store.mutex.Lock()
	defer store.mutex.Unlock()
	data, found := store.objects[object]
	if !found {
		return nil, errObjectNotFound
	}
	if int64(len(data)) > maxBytes {
		return nil, &objectTooLargeError{size: int64(len(data)), maxBytes: maxBytes}
	}
	return data, nil
}

func (store *fakeStore) Upload(ctx context.Context, object string, data []byte, opts uploadOptions) error {
	store.mutex.Lock()
	defer store.mutex.Unlock()
	store.objects[object] = data
	if store.contentTypes == nil {
		store.contentTypes = map[string]string{}
	}
	store.contentTypes[object] = opts.ContentType
	if store.customTimes == nil {
		store.customTimes = map[string]time.Time{}
	}
	store.customTimes[object] = opts.ExpiresAt
	return nil
}

func (store *fakeStore) SignedURL(ctx context.Context, object string, opts signedURLOptions) (string, error) {
	store.mutex.Lock()
	defer store.mutex.Unlock()
	if store.signErr != nil {
		return "", store.signErr
	}
	if store.signedDownloadFileNames == nil {
		store.signedDownloadFileNames = map[string]string{}
	}
	store.signedDownloadFileNames[object] = opts.DownloadFileName
	return "https://signed.example.test/" + object + "?expires=" + strconv.FormatInt(opts.Expires.Unix(), 10), nil
}

func newTestServer(t *testing.T, store *fakeStore) http.Handler {
	t.Helper()
	renderer, err := render.NewRenderer()
	if err != nil {
		t.Fatalf("NewRenderer: %v", err)
	}
	return newServer(store, renderer, 50*1024*1024, time.Minute, newTestExportConfig())
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
	// Page images are permanent derived data: only PDF exports carry an expiry.
	if customTime := store.customTimes["org1/proj1/derived/doc1/page-1.png"]; !customTime.IsZero() {
		t.Fatalf("expected no custom time on page images, got %s", customTime)
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
	var parsed struct {
		Message   string `json:"message"`
		PageCount int    `json:"pageCount"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &parsed); err != nil || parsed.PageCount != 3 {
		t.Fatalf("expected pageCount 3 in the 422 body, got %s", response.Body.String())
	}
	if parsed.Message == "" {
		t.Fatalf("expected a message in the 422 body, got %s", response.Body.String())
	}
	if len(store.objects) != 1 {
		t.Fatalf("expected no uploads, store has %d objects", len(store.objects))
	}
}

func TestRenderDocumentSourceMissing(t *testing.T) {
	response := postRender(newTestServer(t, &fakeStore{objects: map[string][]byte{}}),
		`{"sourceObject":"org1/proj1/nope.pdf","outputPrefix":"org1/proj1/derived/nope/","maxPages":20,"maxPixelsPerPage":4000000}`)
	if response.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", response.Code)
	}
}

func TestRenderDocumentSourceTooLarge(t *testing.T) {
	pdfBytes := pdftest.BuildPdfWithPages(1, 200)
	store := &fakeStore{objects: map[string][]byte{"org1/proj1/doc1.pdf": pdfBytes}}
	renderer, err := render.NewRenderer()
	if err != nil {
		t.Fatalf("NewRenderer: %v", err)
	}
	handler := newServer(store, renderer, int64(len(pdfBytes))-1, time.Minute, newTestExportConfig())
	response := postRender(handler,
		`{"sourceObject":"org1/proj1/doc1.pdf","outputPrefix":"org1/proj1/derived/doc1/","maxPages":20,"maxPixelsPerPage":4000000}`)
	if response.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("expected 413, got %d: %s", response.Code, response.Body.String())
	}
	if len(store.objects) != 1 {
		t.Fatalf("expected no uploads, store has %d objects", len(store.objects))
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

// stalledUploadStore serves the source pdf normally but its uploads hang
// until the request is cancelled, simulating a render pipeline that stalls
// mid-document.
type stalledUploadStore struct {
	objects map[string][]byte
}

func (store *stalledUploadStore) Download(ctx context.Context, object string, maxBytes int64) ([]byte, error) {
	return store.objects[object], nil
}

func (store *stalledUploadStore) Upload(ctx context.Context, object string, data []byte, opts uploadOptions) error {
	<-ctx.Done()
	return ctx.Err()
}

func (store *stalledUploadStore) SignedURL(ctx context.Context, object string, opts signedURLOptions) (string, error) {
	return "https://signed.example.test/" + object, nil
}

func TestRenderDocumentTimesOutWhenRenderingStalls(t *testing.T) {
	store := &stalledUploadStore{objects: map[string][]byte{
		"org1/proj1/doc1.pdf": pdftest.BuildPdfWithPages(2, 200),
	}}
	renderer, err := render.NewRenderer()
	if err != nil {
		t.Fatalf("NewRenderer: %v", err)
	}
	handler := newServer(store, renderer, 50*1024*1024, 50*time.Millisecond, newTestExportConfig())
	response := postRender(handler,
		`{"sourceObject":"org1/proj1/doc1.pdf","outputPrefix":"org1/proj1/derived/doc1/","maxPages":20,"maxPixelsPerPage":4000000}`)
	if response.Code != http.StatusGatewayTimeout {
		t.Fatalf("expected 504, got %d: %s", response.Code, response.Body.String())
	}
	if !strings.Contains(response.Body.String(), "timed out") {
		t.Fatalf("expected a timeout message, got %s", response.Body.String())
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
