#!/bin/sh
# Replace the build-time placeholder __VITE_API_URL__ with the container
# environment. Runs from the nginx image entrypoint before nginx starts.
set -eu

HTML_DIR=/usr/share/nginx/html

escape_value() {
  printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' -e 's/[&|]/\\&/g'
}

files=$(find "$HTML_DIR" -type f \( -name '*.js' -o -name '*.html' \))
escaped=$(escape_value "${VITE_API_URL:-}")
# shellcheck disable=SC2086
echo "$files" | xargs sed -i "s|__VITE_API_URL__|${escaped}|g"

echo "runtime config applied to $(echo "$files" | wc -l | tr -d ' ') files"
