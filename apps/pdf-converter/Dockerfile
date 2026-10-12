FROM golang:1.26-bookworm AS build
WORKDIR /src
COPY apps/pdf-converter/go.mod apps/pdf-converter/go.sum ./
RUN go mod download
COPY apps/pdf-converter/ ./
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o /pdf-converter .

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /pdf-converter /pdf-converter
ENV PORT=3002
ENTRYPOINT ["/pdf-converter"]
