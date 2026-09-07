package main

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"cloud.google.com/go/storage"
)

// errObjectNotFound normalizes "missing object" across the real GCS store and
// test fakes so the handler can map it to a 404.
var errObjectNotFound = errors.New("object not found")

// objectTooLargeError reports an object exceeding the caller's byte cap, so
// the handler can map it to a 413 with the actual size.
type objectTooLargeError struct {
	size     int64
	maxBytes int64
}

func (err *objectTooLargeError) Error() string {
	return fmt.Sprintf("object is %d bytes, max is %d", err.size, err.maxBytes)
}

// signedURLOptions describes a time-limited download link for one object.
type signedURLOptions struct {
	Expires time.Time
	// DownloadFileName is already sanitized; it is offered to the browser
	// through Content-Disposition.
	DownloadFileName string
}

type objectStore interface {
	Download(ctx context.Context, object string, maxBytes int64) ([]byte, error)
	Upload(ctx context.Context, object string, contentType string, data []byte) error
	SignedURL(ctx context.Context, object string, opts signedURLOptions) (string, error)
}

type gcsStore struct {
	bucket *storage.BucketHandle
}

// Download enforces maxBytes on the same object generation it reads: the size
// in reader.Attrs comes from the read response itself, so it cannot diverge
// from the bytes (unlike a separate Attrs call, which races with overwrites).
func (store *gcsStore) Download(ctx context.Context, object string, maxBytes int64) ([]byte, error) {
	reader, err := store.bucket.Object(object).NewReader(ctx)
	if errors.Is(err, storage.ErrObjectNotExist) {
		return nil, errObjectNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("open %s: %w", object, err)
	}
	defer reader.Close()
	if reader.Attrs.Size > maxBytes {
		return nil, &objectTooLargeError{size: reader.Attrs.Size, maxBytes: maxBytes}
	}
	data, err := io.ReadAll(io.LimitReader(reader, maxBytes+1))
	if err != nil {
		return nil, fmt.Errorf("read %s: %w", object, err)
	}
	if int64(len(data)) > maxBytes {
		return nil, &objectTooLargeError{size: int64(len(data)), maxBytes: maxBytes}
	}
	return data, nil
}

func (store *gcsStore) Upload(ctx context.Context, object string, contentType string, data []byte) error {
	writer := store.bucket.Object(object).NewWriter(ctx)
	writer.ContentType = contentType
	// The payload is fully in memory and small (a page PNG or an exported
	// PDF); ChunkSize 0 uploads it in a single request instead of staging a
	// 16MiB resumable buffer.
	writer.ChunkSize = 0
	if _, err := writer.Write(data); err != nil {
		writer.Close()
		return fmt.Errorf("write %s: %w", object, err)
	}
	if err := writer.Close(); err != nil {
		return fmt.Errorf("close %s: %w", object, err)
	}
	return nil
}

// SignedURL mints a V4 GET URL that hands the object straight to the browser
// as a download. Signing needs a credential that can sign: a service-account
// key locally, or the IAM Credentials API on Cloud Run. ctx is unused by
// BucketHandle.SignedURL but stays on the interface for symmetry with the
// other methods.
func (store *gcsStore) SignedURL(ctx context.Context, object string, opts signedURLOptions) (string, error) {
	signed, err := store.bucket.SignedURL(object, &storage.SignedURLOptions{
		Scheme:  storage.SigningSchemeV4,
		Method:  http.MethodGet,
		Expires: opts.Expires,
		QueryParameters: url.Values{
			"response-content-disposition": {contentDisposition(opts.DownloadFileName)},
		},
	})
	if err != nil {
		return "", fmt.Errorf("sign %s: %w", object, err)
	}
	return signed, nil
}

// contentDisposition builds the attachment header for a download name that may
// contain non-ASCII letters. Per RFC 6266 it carries both forms: a quoted
// ASCII-only filename that any client understands, and the RFC 5987 extended
// filename* holding the real UTF-8 name, which every current browser prefers.
func contentDisposition(fileName string) string {
	return fmt.Sprintf(
		"attachment; filename=%q; filename*=UTF-8''%s",
		asciiDownloadFileName(fileName),
		percentEncodeExtendedValue(fileName),
	)
}

// asciiDownloadFileName reduces a name to the characters that are safe inside a
// quoted filename parameter: [A-Za-z0-9._ -]. A stem written entirely outside
// that set (say all CJK) leaves nothing but the extension, so the stem falls
// back to "document" rather than to a dot file.
func asciiDownloadFileName(fileName string) string {
	var kept strings.Builder
	for _, letter := range fileName {
		switch {
		case letter >= 'A' && letter <= 'Z', letter >= 'a' && letter <= 'z',
			letter >= '0' && letter <= '9',
			letter == '.', letter == '_', letter == '-', letter == ' ':
			kept.WriteRune(letter)
		}
	}
	cleaned := kept.String()
	extension := ""
	if dot := strings.LastIndexByte(cleaned, '.'); dot >= 0 {
		extension = cleaned[dot:]
		cleaned = cleaned[:dot]
	}
	stem := strings.Trim(cleaned, ". ")
	switch {
	case stem == "" && extension == "":
		return "document.pdf"
	case stem == "":
		return "document" + extension
	}
	return stem + extension
}

// extendedValueAttrChars lists the RFC 5987 attr-char punctuation. Everything
// else, space and the delimiters "*", "'" and "%" included, is percent-encoded
// byte by byte from the UTF-8 encoding of the name.
const extendedValueAttrChars = "!#$&+-.^_`|~"

func percentEncodeExtendedValue(value string) string {
	var encoded strings.Builder
	for _, octet := range []byte(value) {
		switch {
		case octet >= 'A' && octet <= 'Z', octet >= 'a' && octet <= 'z',
			octet >= '0' && octet <= '9',
			strings.IndexByte(extendedValueAttrChars, octet) >= 0:
			encoded.WriteByte(octet)
		default:
			fmt.Fprintf(&encoded, "%%%02X", octet)
		}
	}
	return encoded.String()
}
