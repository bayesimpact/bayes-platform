package main

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLoadDotenv(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, ".env")
	content := "# comment\n\nDOTENV_TEST_PLAIN=plain\nDOTENV_TEST_SPACED = spaced value \nexport DOTENV_TEST_EXPORTED=exported\nDOTENV_TEST_DOUBLE=\"double # quoted\"\nDOTENV_TEST_SINGLE='single'\nDOTENV_TEST_EMPTY=\nDOTENV_TEST_EXISTING=from-file\nDOTENV_TEST_EQUALS=a=b\nnot a valid line\n"
	if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
		t.Fatal(err)
	}
	t.Setenv("DOTENV_TEST_EXISTING", "from-env")
	for _, key := range []string{"DOTENV_TEST_PLAIN", "DOTENV_TEST_SPACED", "DOTENV_TEST_EXPORTED", "DOTENV_TEST_DOUBLE", "DOTENV_TEST_SINGLE", "DOTENV_TEST_EMPTY", "DOTENV_TEST_EQUALS"} {
		t.Setenv(key, "")
		os.Unsetenv(key)
	}

	if err := loadDotenv(path); err != nil {
		t.Fatalf("loadDotenv: %v", err)
	}

	want := map[string]string{
		"DOTENV_TEST_PLAIN":    "plain",
		"DOTENV_TEST_SPACED":   "spaced value",
		"DOTENV_TEST_EXPORTED": "exported",
		"DOTENV_TEST_DOUBLE":   "double # quoted",
		"DOTENV_TEST_SINGLE":   "single",
		"DOTENV_TEST_EMPTY":    "",
		"DOTENV_TEST_EXISTING": "from-env",
		"DOTENV_TEST_EQUALS":   "a=b",
	}
	for key, expected := range want {
		if got := os.Getenv(key); got != expected {
			t.Errorf("%s = %q, want %q", key, got, expected)
		}
	}
	if _, set := os.LookupEnv("not a valid line"); set {
		t.Error("invalid line must be ignored")
	}
}

func TestLoadDotenvMissingFileIsNoop(t *testing.T) {
	if err := loadDotenv(filepath.Join(t.TempDir(), ".env")); err != nil {
		t.Fatalf("missing file must be a no-op, got %v", err)
	}
}
