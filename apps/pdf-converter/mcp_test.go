package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/modelcontextprotocol/go-sdk/mcp"
)

// testExportNow freezes the clock so the signed URL and expiresAt are exact.
var testExportNow = time.Date(2026, 9, 7, 12, 0, 0, 0, time.UTC)

func newTestExportConfig() pdfExportConfig {
	return pdfExportConfig{
		TTL:              15 * time.Minute,
		MaxMarkdownBytes: 1 << 20,
		TmpPrefix:        defaultPdfExportPrefix,
		Timeout:          time.Minute,
		MaxPages:         pdfExportMaxPages,
		Now:              func() time.Time { return testExportNow },
		NewID:            func() string { return "fixed-id" },
	}
}

func connectMCP(t *testing.T, handler http.Handler) *mcp.ClientSession {
	t.Helper()
	httpServer := httptest.NewServer(handler)
	t.Cleanup(httpServer.Close)
	client := mcp.NewClient(&mcp.Implementation{Name: "pdf-converter-test", Version: "1.0.0"}, nil)
	session, err := client.Connect(
		context.Background(), &mcp.StreamableClientTransport{Endpoint: httpServer.URL}, nil)
	if err != nil {
		t.Fatalf("connect to the mcp endpoint: %v", err)
	}
	t.Cleanup(func() {
		if err := session.Close(); err != nil {
			t.Errorf("close the mcp session: %v", err)
		}
	})
	return session
}

// callConvert calls the export tool and fails the test on a protocol error (as
// opposed to a tool result carrying IsError).
func callConvert(t *testing.T, session *mcp.ClientSession, arguments map[string]any) *mcp.CallToolResult {
	t.Helper()
	result, err := session.CallTool(context.Background(), &mcp.CallToolParams{
		Name:      pdfExportToolName,
		Arguments: arguments,
	})
	if err != nil {
		t.Fatalf("call %s: %v", pdfExportToolName, err)
	}
	return result
}

func resultText(t *testing.T, result *mcp.CallToolResult) string {
	t.Helper()
	var texts []string
	for _, content := range result.Content {
		text, isText := content.(*mcp.TextContent)
		if !isText {
			t.Fatalf("expected text content, got %T", content)
		}
		texts = append(texts, text.Text)
	}
	if len(texts) == 0 {
		t.Fatalf("expected at least one content block")
	}
	return strings.Join(texts, "\n")
}

func TestMCPListToolsDeclaresDownloadCard(t *testing.T) {
	session := connectMCP(t, newMCPHandler(&fakeStore{objects: map[string][]byte{}}, newTestExportConfig()))
	tools, err := session.ListTools(context.Background(), nil)
	if err != nil {
		t.Fatalf("list tools: %v", err)
	}
	if len(tools.Tools) != 1 || tools.Tools[0].Name != pdfExportToolName {
		t.Fatalf("expected exactly one %s tool, got %+v", pdfExportToolName, tools.Tools)
	}

	tool := tools.Tools[0]
	uiMeta, isMap := tool.Meta["ui"].(map[string]any)
	if !isMap {
		t.Fatalf("expected a _meta.ui object, got %#v", tool.Meta["ui"])
	}
	if uiMeta["resourceUri"] != downloadCardURI {
		t.Fatalf("expected resourceUri %q, got %#v", downloadCardURI, uiMeta["resourceUri"])
	}

	schema, isMap := tool.InputSchema.(map[string]any)
	if !isMap {
		t.Fatalf("expected an input schema object, got %#v", tool.InputSchema)
	}
	required, _ := schema["required"].([]any)
	if len(required) != 1 || required[0] != "markdown" {
		t.Fatalf("expected only markdown to be required, got %#v", schema["required"])
	}
}

func TestMCPConvertMarkdownHappyPath(t *testing.T) {
	store := &fakeStore{objects: map[string][]byte{}}
	session := connectMCP(t, newMCPHandler(store, newTestExportConfig()))
	result := callConvert(t, session, map[string]any{
		"markdown": "# Rapport final\n\nQuarterly notes for the platform team.\n",
		"fileName": "Rapport final",
	})
	if result.IsError {
		t.Fatalf("expected a successful call, got %s", resultText(t, result))
	}

	structured, err := json.Marshal(result.StructuredContent)
	if err != nil {
		t.Fatalf("marshal structured content: %v", err)
	}
	var output convertMarkdownOutput
	if err := json.Unmarshal(structured, &output); err != nil {
		t.Fatalf("unmarshal structured content %s: %v", structured, err)
	}

	const wantObject = "tmp/pdf-exports/fixed-id/Rapport final.pdf"
	if output.FileName != "Rapport final.pdf" {
		t.Fatalf("expected fileName %q, got %q", "Rapport final.pdf", output.FileName)
	}
	if output.PageCount < 1 {
		t.Fatalf("expected at least one page, got %d", output.PageCount)
	}
	if output.ExpiresAt != "2026-09-07T12:15:00Z" {
		t.Fatalf("expected expiresAt 2026-09-07T12:15:00Z, got %q", output.ExpiresAt)
	}
	wantURL := "https://signed.example.test/" + wantObject + "?expires=" +
		fmt.Sprint(testExportNow.Add(15*time.Minute).Unix())
	if output.DownloadURL != wantURL {
		t.Fatalf("expected downloadUrl %q, got %q", wantURL, output.DownloadURL)
	}

	stored, found := store.objects[wantObject]
	if !found {
		t.Fatalf("expected an object at %q, store has %v", wantObject, store.objects)
	}
	if !strings.HasPrefix(string(stored), "%PDF-") {
		t.Fatalf("expected the stored object to be a pdf, got %q", string(stored[:min(8, len(stored))]))
	}
	if output.SizeBytes != int64(len(stored)) {
		t.Fatalf("expected sizeBytes %d, got %d", len(stored), output.SizeBytes)
	}
	if store.contentTypes[wantObject] != "application/pdf" {
		t.Fatalf("expected content type application/pdf, got %q", store.contentTypes[wantObject])
	}
	// The sweep in apps/api deletes the object from this stamp, so it must be
	// the exact instant the signed URL stops working.
	if wantCustomTime := testExportNow.Add(15 * time.Minute); !store.customTimes[wantObject].Equal(wantCustomTime) {
		t.Fatalf("expected the object custom time to equal the url expiry %s, got %s",
			wantCustomTime, store.customTimes[wantObject])
	}
	if store.signedDownloadFileNames[wantObject] != "Rapport final.pdf" {
		t.Fatalf("expected the signed url to carry the download file name %q, got %q",
			"Rapport final.pdf", store.signedDownloadFileNames[wantObject])
	}

	text := resultText(t, result)
	if !strings.Contains(text, "Rapport final.pdf") || !strings.Contains(text, output.ExpiresAt) {
		t.Fatalf("expected the text to mention the file name and the expiry, got %q", text)
	}
	if strings.Contains(text, "https://") {
		t.Fatalf("the model-visible text must not carry the signed url, got %q", text)
	}
}

// TestMCPConvertMarkdownConcurrentCalls covers the render semaphore: two
// exports in flight at once both come back, they do not deadlock on a slot.
func TestMCPConvertMarkdownConcurrentCalls(t *testing.T) {
	config := newTestExportConfig()
	var idMutex sync.Mutex
	idCount := 0
	config.NewID = func() string {
		idMutex.Lock()
		defer idMutex.Unlock()
		idCount++
		return fmt.Sprintf("id-%d", idCount)
	}
	store := &fakeStore{objects: map[string][]byte{}}
	session := connectMCP(t, newMCPHandler(store, config))

	var calls sync.WaitGroup
	for callIndex := range 2 {
		calls.Add(1)
		go func() {
			defer calls.Done()
			result, err := session.CallTool(context.Background(), &mcp.CallToolParams{
				Name:      pdfExportToolName,
				Arguments: map[string]any{"markdown": fmt.Sprintf("# Export %d\n", callIndex)},
			})
			if err != nil {
				t.Errorf("call %s: %v", pdfExportToolName, err)
				return
			}
			if result.IsError {
				t.Errorf("expected call %d to succeed, it came back as an error result", callIndex)
			}
		}()
	}
	calls.Wait()

	if len(store.objects) != 2 {
		t.Fatalf("expected two exports, store has %v", store.objects)
	}
}

func TestMCPConvertMarkdownValidationErrors(t *testing.T) {
	config := newTestExportConfig()
	config.MaxMarkdownBytes = 32
	store := &fakeStore{objects: map[string][]byte{}}
	session := connectMCP(t, newMCPHandler(store, config))

	for _, testCase := range []struct {
		name     string
		markdown string
	}{
		{name: "empty", markdown: "   \n  "},
		{name: "over the byte cap", markdown: strings.Repeat("a", config.MaxMarkdownBytes+1)},
	} {
		t.Run(testCase.name, func(t *testing.T) {
			result := callConvert(t, session, map[string]any{"markdown": testCase.markdown})
			if !result.IsError {
				t.Fatalf("expected an error result, got %+v", result)
			}
			if resultText(t, result) == "" {
				t.Fatalf("expected the error result to carry text content")
			}
		})
	}
	if len(store.objects) != 0 {
		t.Fatalf("expected no uploads, store has %v", store.objects)
	}
}

func TestMCPConvertMarkdownPageLimit(t *testing.T) {
	config := newTestExportConfig()
	config.MaxPages = 1
	store := &fakeStore{objects: map[string][]byte{}}
	session := connectMCP(t, newMCPHandler(store, config))

	var markdown strings.Builder
	markdown.WriteString("# Product overview\n\n")
	for paragraphIndex := 1; paragraphIndex <= 200; paragraphIndex++ {
		fmt.Fprintf(&markdown,
			"Paragraph %d: pricing, support and onboarding notes for the current quarter.\n\n",
			paragraphIndex)
	}

	result := callConvert(t, session, map[string]any{"markdown": markdown.String()})
	if !result.IsError {
		t.Fatalf("expected an error result, got %+v", result)
	}
	if !strings.Contains(resultText(t, result), "pages") {
		t.Fatalf("expected the message to mention pages, got %q", resultText(t, result))
	}
	if len(store.objects) != 0 {
		t.Fatalf("expected no uploads, store has %v", store.objects)
	}
}

func TestMCPConvertMarkdownSignedURLFailure(t *testing.T) {
	store := &fakeStore{objects: map[string][]byte{}, signErr: errors.New("no signing credentials")}
	session := connectMCP(t, newMCPHandler(store, newTestExportConfig()))
	result := callConvert(t, session, map[string]any{"markdown": "# Report\n\nBody.\n"})
	if !result.IsError {
		t.Fatalf("expected an error result, got %+v", result)
	}
	if resultText(t, result) == "" {
		t.Fatalf("expected the error result to carry text content")
	}
	// Signing happens before uploading, so a signing failure must never leave
	// an orphaned upload in the bucket.
	if len(store.objects) != 0 {
		t.Fatalf("expected no uploads when signing fails, store has %v", store.objects)
	}
}

func TestMCPReadDownloadCard(t *testing.T) {
	session := connectMCP(t, newMCPHandler(&fakeStore{objects: map[string][]byte{}}, newTestExportConfig()))
	result, err := session.ReadResource(context.Background(), &mcp.ReadResourceParams{URI: downloadCardURI})
	if err != nil {
		t.Fatalf("read %s: %v", downloadCardURI, err)
	}
	if len(result.Contents) != 1 {
		t.Fatalf("expected exactly one content, got %d", len(result.Contents))
	}
	contents := result.Contents[0]
	if contents.URI != downloadCardURI {
		t.Fatalf("expected uri %q, got %q", downloadCardURI, contents.URI)
	}
	if contents.MIMEType != mcpAppMIMEType {
		t.Fatalf("expected mime type %q, got %q", mcpAppMIMEType, contents.MIMEType)
	}
	for _, needle := range []string{
		"ui/initialize",
		"ui/notifications/initialized",
		"ui/notifications/tool-result",
		"ui/notifications/size-changed",
		// The card must validate downloadUrl before using it as an href.
		`"https:"`,
	} {
		if !strings.Contains(contents.Text, needle) {
			t.Fatalf("expected the card to speak %s", needle)
		}
	}
	// The anchor is the only download path: the card never asks the host to
	// open the link for it, so a blocked ui/open-link cannot swallow a click.
	if strings.Contains(contents.Text, "ui/open-link") {
		t.Fatal("the card must not send ui/open-link")
	}
	// The host rewrites this literal, so the card must never contain it.
	if strings.Contains(contents.Text, "</iframe") {
		t.Fatalf("the card must not contain a closing iframe tag")
	}
}

func TestMCPGetIsMethodNotAllowed(t *testing.T) {
	request := httptest.NewRequest(http.MethodGet, "/mcp", nil)
	recorder := httptest.NewRecorder()
	newTestServer(t, &fakeStore{objects: map[string][]byte{}}).ServeHTTP(recorder, request)
	if recorder.Code != http.StatusMethodNotAllowed {
		t.Fatalf("expected 405, got %d", recorder.Code)
	}
	if recorder.Header().Get("Allow") != http.MethodPost {
		t.Fatalf("expected an Allow: POST header, got %q", recorder.Header().Get("Allow"))
	}
}

func TestSanitizeFileName(t *testing.T) {
	for _, testCase := range []struct {
		name string
		in   string
		want string
	}{
		{name: "empty", in: "", want: "document.pdf"},
		{name: "path traversal", in: "../etc/passwd", want: "etcpasswd.pdf"},
		{name: "accents kept", in: "Résumé.pdf", want: "Résumé.pdf"},
		{name: "non latin kept", in: "報告.pdf", want: "報告.pdf"},
		{name: "quotes stripped", in: `a"b'c.pdf`, want: "abc.pdf"},
		{name: "control characters stripped", in: "a\x00b\x1fc.pdf", want: "abc.pdf"},
		{name: "whitespace collapsed", in: "a  b", want: "a b.pdf"},
		{
			name: "truncated to 100 runes",
			in:   strings.Repeat("n", 300),
			want: strings.Repeat("n", maxFileNameRunes) + ".pdf",
		},
		{name: "extension only", in: ".pdf", want: "document.pdf"},
		{name: "repeated extension", in: "report.pdf.pdf", want: "report.pdf"},
	} {
		t.Run(testCase.name, func(t *testing.T) {
			if got := sanitizeFileName(testCase.in); got != testCase.want {
				t.Fatalf("sanitizeFileName(%q) = %q, want %q", testCase.in, got, testCase.want)
			}
		})
	}
}

func TestContentDisposition(t *testing.T) {
	for _, testCase := range []struct {
		name string
		in   string
		want string
	}{
		{
			name: "ascii name is identical in both parameters",
			in:   "report.pdf",
			want: `attachment; filename="report.pdf"; filename*=UTF-8''report.pdf`,
		},
		{
			name: "accented name keeps an ascii fallback",
			in:   "Résumé.pdf",
			want: `attachment; filename="Rsum.pdf"; filename*=UTF-8''R%C3%A9sum%C3%A9.pdf`,
		},
		{
			name: "spaces and quotes are percent encoded",
			in:   `a b".pdf`,
			want: `attachment; filename="a b.pdf"; filename*=UTF-8''a%20b%22.pdf`,
		},
		{
			name: "stem without ascii letters falls back",
			in:   "報告.pdf",
			want: `attachment; filename="document.pdf"; filename*=UTF-8''%E5%A0%B1%E5%91%8A.pdf`,
		},
	} {
		t.Run(testCase.name, func(t *testing.T) {
			if got := contentDisposition(testCase.in); got != testCase.want {
				t.Fatalf("contentDisposition(%q) = %q, want %q", testCase.in, got, testCase.want)
			}
		})
	}
}
