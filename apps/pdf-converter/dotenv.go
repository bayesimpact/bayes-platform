package main

import (
	"bufio"
	"errors"
	"os"
	"strings"
)

// loadDotenv sets the KEY=value pairs found in path as environment variables,
// skipping keys already present in the environment. A missing file is a no-op
// so the same binary runs unchanged in the image and in production, where the
// configuration comes from the environment only. Supported syntax is what
// .env-example uses: blank lines, # comments, an optional "export " prefix and
// values optionally wrapped in single or double quotes.
func loadDotenv(path string) error {
	file, err := os.Open(path)
	if errors.Is(err, os.ErrNotExist) {
		return nil
	}
	if err != nil {
		return err
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		line = strings.TrimPrefix(line, "export ")
		key, rawValue, found := strings.Cut(line, "=")
		key = strings.TrimSpace(key)
		if !found || key == "" || strings.ContainsAny(key, " \t") {
			continue
		}
		if _, alreadySet := os.LookupEnv(key); alreadySet {
			continue
		}
		if err := os.Setenv(key, unquote(strings.TrimSpace(rawValue))); err != nil {
			return err
		}
	}
	return scanner.Err()
}

func unquote(value string) string {
	if len(value) >= 2 {
		first, last := value[0], value[len(value)-1]
		if (first == '"' || first == '\'') && first == last {
			return value[1 : len(value)-1]
		}
	}
	return value
}
