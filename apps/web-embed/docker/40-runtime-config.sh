#!/bin/sh
# Replace the build-time placeholders __VITE_API_URL__ and
# __VITE_MCP_APP_SANDBOX_ORIGIN__ with the container environment. Runs from the
# nginx image entrypoint before nginx starts. An unset variable gives an empty
# value: with no sandbox origin, the widget writes the sandbox of a card itself.
set -eu

HTML_DIR=/usr/share/nginx/html

escape_value() {
  printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' -e 's/[&|]/\\&/g'
}

files=$(find "$HTML_DIR" -type f \( -name '*.js' -o -name '*.html' \))
escaped=$(escape_value "${VITE_API_URL:-}")
# shellcheck disable=SC2086
echo "$files" | xargs sed -i "s|__VITE_API_URL__|${escaped}|g"
escaped=$(escape_value "${VITE_MCP_APP_SANDBOX_ORIGIN:-}")
# shellcheck disable=SC2086
echo "$files" | xargs sed -i "s|__VITE_MCP_APP_SANDBOX_ORIGIN__|${escaped}|g"

echo "runtime config applied to $(echo "$files" | wc -l | tr -d ' ') files"
