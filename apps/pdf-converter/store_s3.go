package main

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/s3/types"
	"github.com/aws/smithy-go/middleware"
	smithyhttp "github.com/aws/smithy-go/transport/http"
)

// s3Settings mirrors the S3_* variables the API reads, so both services
// point at the same bucket the same way.
type s3Settings struct {
	Bucket          string
	Endpoint        string
	PublicEndpoint  string
	Region          string
	AccessKeyID     string
	SecretAccessKey string
	ForcePathStyle  bool
}

// s3Store talks to any S3-compatible storage. Download URLs go to browsers,
// so they are signed for PublicEndpoint when it is set: the host is part of
// the signature.
type s3Store struct {
	bucket  string
	client  *s3.Client
	presign *s3.PresignClient
}

func newS3Store(ctx context.Context, settings s3Settings) (*s3Store, error) {
	if settings.Region == "" {
		settings.Region = "us-east-1"
	}
	awsConfig := aws.Config{
		Region: settings.Region,
		Credentials: credentials.NewStaticCredentialsProvider(
			settings.AccessKeyID, settings.SecretAccessKey, ""),
	}
	// Without static keys the SDK uses its default chain (environment, IAM role).
	if settings.AccessKeyID == "" || settings.SecretAccessKey == "" {
		loaded, err := config.LoadDefaultConfig(ctx, config.WithRegion(settings.Region))
		if err != nil {
			return nil, fmt.Errorf("s3 config: %w", err)
		}
		awsConfig = loaded
	}
	newClient := func(endpoint string) *s3.Client {
		return s3.NewFromConfig(awsConfig, func(options *s3.Options) {
			if endpoint != "" {
				options.BaseEndpoint = aws.String(endpoint)
			}
			options.UsePathStyle = settings.ForcePathStyle
			// The SDK adds CRC checksums by default; several S3-compatible
			// stores reject them.
			options.RequestChecksumCalculation = aws.RequestChecksumCalculationWhenRequired
			options.ResponseChecksumValidation = aws.ResponseChecksumValidationWhenRequired
			options.APIOptions = append(options.APIOptions, leaveAcceptEncodingUnsigned)
		})
	}
	client := newClient(settings.Endpoint)
	signingClient := client
	if settings.PublicEndpoint != "" && settings.PublicEndpoint != settings.Endpoint {
		signingClient = newClient(settings.PublicEndpoint)
	}
	return &s3Store{bucket: settings.Bucket, client: client, presign: s3.NewPresignClient(signingClient)}, nil
}

type acceptEncodingKey struct{}

// leaveAcceptEncodingUnsigned keeps Accept-Encoding out of the request
// signature. The SDK sends and signs "Accept-Encoding: identity"; the front
// end of Cloud Storage rewrites that header before checking the signature, so
// every call fails with SignatureDoesNotMatch. The header is still sent.
func leaveAcceptEncodingUnsigned(stack *middleware.Stack) error {
	remove := middleware.FinalizeMiddlewareFunc("RemoveAcceptEncoding",
		func(ctx context.Context, in middleware.FinalizeInput, next middleware.FinalizeHandler) (middleware.FinalizeOutput, middleware.Metadata, error) {
			if request, ok := in.Request.(*smithyhttp.Request); ok {
				ctx = middleware.WithStackValue(ctx, acceptEncodingKey{}, request.Header.Get("Accept-Encoding"))
				request.Header.Del("Accept-Encoding")
			}
			return next.HandleFinalize(ctx, in)
		})
	restore := middleware.FinalizeMiddlewareFunc("RestoreAcceptEncoding",
		func(ctx context.Context, in middleware.FinalizeInput, next middleware.FinalizeHandler) (middleware.FinalizeOutput, middleware.Metadata, error) {
			if request, ok := in.Request.(*smithyhttp.Request); ok {
				if value, _ := middleware.GetStackValue(ctx, acceptEncodingKey{}).(string); value != "" {
					request.Header.Set("Accept-Encoding", value)
				}
			}
			return next.HandleFinalize(ctx, in)
		})
	if err := stack.Finalize.Insert(remove, "Signing", middleware.Before); err != nil {
		return err
	}
	return stack.Finalize.Insert(restore, "Signing", middleware.After)
}

// Download checks the size the response announces, then caps the read at
// maxBytes+1 so a wrong announcement cannot exhaust memory.
func (store *s3Store) Download(ctx context.Context, object string, maxBytes int64) ([]byte, error) {
	response, err := store.client.GetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(store.bucket),
		Key:    aws.String(object),
	})
	var noSuchKey *types.NoSuchKey
	if errors.As(err, &noSuchKey) {
		return nil, errObjectNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("open %s: %w", object, err)
	}
	defer response.Body.Close()
	if size := aws.ToInt64(response.ContentLength); size > maxBytes {
		return nil, &objectTooLargeError{size: size, maxBytes: maxBytes}
	}
	data, err := io.ReadAll(io.LimitReader(response.Body, maxBytes+1))
	if err != nil {
		return nil, fmt.Errorf("read %s: %w", object, err)
	}
	if int64(len(data)) > maxBytes {
		return nil, &objectTooLargeError{size: int64(len(data)), maxBytes: maxBytes}
	}
	return data, nil
}

func (store *s3Store) Upload(ctx context.Context, object string, data []byte, opts uploadOptions) error {
	_, err := store.client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:        aws.String(store.bucket),
		Key:           aws.String(object),
		Body:          bytes.NewReader(data),
		ContentLength: aws.Int64(int64(len(data))),
		ContentType:   aws.String(opts.ContentType),
	})
	if err != nil {
		return fmt.Errorf("write %s: %w", object, err)
	}
	return nil
}

// SignedURL mints a GET URL that hands the object straight to the browser as
// a download. Signing is local: it needs no call to the storage.
func (store *s3Store) SignedURL(ctx context.Context, object string, opts signedURLOptions) (string, error) {
	signed, err := store.presign.PresignGetObject(ctx, &s3.GetObjectInput{
		Bucket:                     aws.String(store.bucket),
		Key:                        aws.String(object),
		ResponseContentDisposition: aws.String(contentDisposition(opts.DownloadFileName)),
	}, s3.WithPresignExpires(time.Until(opts.Expires)))
	if err != nil {
		return "", fmt.Errorf("sign %s: %w", object, err)
	}
	return signed.URL, nil
}
