package main

import (
	"context"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/google/uuid"
)

// newTestS3Store runs against a real S3-compatible store: SeaweedFS from
// infra/database (profile `storage`). Without S3_TEST_ENDPOINT it skips.
func newTestS3Store(t *testing.T) *s3Store {
	t.Helper()
	endpoint := os.Getenv("S3_TEST_ENDPOINT")
	if endpoint == "" {
		t.Skip("S3_TEST_ENDPOINT is not set")
	}
	accessKeyID := os.Getenv("S3_TEST_ACCESS_KEY_ID")
	if accessKeyID == "" {
		accessKeyID = "local-dev-access-key"
	}
	secretAccessKey := os.Getenv("S3_TEST_SECRET_ACCESS_KEY")
	if secretAccessKey == "" {
		secretAccessKey = "local-dev-secret-key"
	}
	ctx := context.Background()
	store, err := newS3Store(ctx, s3Settings{
		Bucket:          "test-" + uuid.NewString(),
		Endpoint:        endpoint,
		AccessKeyID:     accessKeyID,
		SecretAccessKey: secretAccessKey,
		ForcePathStyle:  true,
	})
	if err != nil {
		t.Fatalf("new s3 store: %v", err)
	}
	if _, err := store.client.CreateBucket(ctx, &s3.CreateBucketInput{Bucket: aws.String(store.bucket)}); err != nil {
		t.Fatalf("create bucket: %v", err)
	}
	return store
}

// Cloud Storage rewrites Accept-Encoding before checking the signature: the
// header must be sent but left out of SignedHeaders.
func TestS3StoreLeavesAcceptEncodingUnsigned(t *testing.T) {
	var authorization, acceptEncoding string
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		authorization = request.Header.Get("Authorization")
		acceptEncoding = request.Header.Get("Accept-Encoding")
		writer.WriteHeader(http.StatusOK)
	}))
	defer server.Close()
	ctx := context.Background()
	store, err := newS3Store(ctx, s3Settings{
		Bucket:          "documents",
		Endpoint:        server.URL,
		AccessKeyID:     "access-key",
		SecretAccessKey: "secret-key",
		ForcePathStyle:  true,
	})
	if err != nil {
		t.Fatalf("new s3 store: %v", err)
	}

	if err := store.Upload(ctx, "tmp/test.pdf", []byte("%PDF-1.4 test"), uploadOptions{ContentType: "application/pdf"}); err != nil {
		t.Fatalf("upload: %v", err)
	}

	if !strings.Contains(authorization, "SignedHeaders=") {
		t.Fatalf("expected a SigV4 authorization, got %q", authorization)
	}
	if strings.Contains(authorization, "accept-encoding") {
		t.Fatalf("expected accept-encoding out of the signed headers, got %q", authorization)
	}
	if acceptEncoding != "identity" {
		t.Fatalf("expected Accept-Encoding identity to be sent, got %q", acceptEncoding)
	}

	signed, err := store.SignedURL(ctx, "tmp/test.pdf", signedURLOptions{
		Expires:          time.Now().Add(time.Minute),
		DownloadFileName: "test.pdf",
	})
	if err != nil {
		t.Fatalf("sign: %v", err)
	}
	if !strings.Contains(signed, "X-Amz-Signature=") || strings.Contains(signed, "accept-encoding") {
		t.Fatalf("expected a presigned URL without accept-encoding, got %q", signed)
	}
}

func TestS3StoreRoundTrip(t *testing.T) {
	store := newTestS3Store(t)
	ctx := context.Background()
	object := "tmp/pdf-exports/" + uuid.NewString() + "/Rapport final.pdf"
	data := []byte("%PDF-1.4 test")

	if err := store.Upload(ctx, object, data, uploadOptions{ContentType: "application/pdf"}); err != nil {
		t.Fatalf("upload: %v", err)
	}

	downloaded, err := store.Download(ctx, object, int64(len(data)))
	if err != nil || string(downloaded) != string(data) {
		t.Fatalf("expected %q, got %q (%v)", data, downloaded, err)
	}
	var tooLarge *objectTooLargeError
	if _, err := store.Download(ctx, object, int64(len(data)-1)); !errors.As(err, &tooLarge) {
		t.Fatalf("expected objectTooLargeError, got %v", err)
	}
	if _, err := store.Download(ctx, "missing/"+uuid.NewString(), 10); !errors.Is(err, errObjectNotFound) {
		t.Fatalf("expected errObjectNotFound, got %v", err)
	}

	signed, err := store.SignedURL(ctx, object, signedURLOptions{
		Expires:          time.Now().Add(time.Minute),
		DownloadFileName: "Rapport final.pdf",
	})
	if err != nil {
		t.Fatalf("sign: %v", err)
	}
	response, err := http.Get(signed)
	if err != nil {
		t.Fatalf("get signed url: %v", err)
	}
	defer response.Body.Close()
	body, _ := io.ReadAll(response.Body)
	if response.StatusCode != http.StatusOK || string(body) != string(data) {
		t.Fatalf("expected 200 with the pdf, got %d %q", response.StatusCode, body)
	}
	if disposition := response.Header.Get("Content-Disposition"); !strings.Contains(disposition, "attachment") {
		t.Fatalf("expected an attachment disposition, got %q", disposition)
	}
}
