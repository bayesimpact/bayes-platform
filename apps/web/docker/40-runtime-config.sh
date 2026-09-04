#!/bin/sh
# Replace the build-time placeholders (__VITE_API_URL__ ...) with the container
# environment, so one image serves every install. Runs from the nginx image
# entrypoint before nginx starts. A variable that is not set becomes an empty
# string, the same as an unset variable at build time.
set -eu

HTML_DIR=/usr/share/nginx/html

RUNTIME_VARS="
VITE_API_URL
VITE_APP_TITLE
VITE_AUTH0_DOMAIN
VITE_AUTH0_CLIENT_ID
VITE_AUTH0_AUDIENCE
VITE_AUTH0_ORGANIZATION_ID
VITE_AGENT_EMBED_URL
VITE_HELP_CENTER_URL
VITE_HELP_AGENT_EMBED_URL
VITE_HELP_AGENT_EMBED_TOKEN
VITE_HELP_AGENT_EMBED_COLOR
VITE_HELP_AGENT_EMBED_HINT
"

# Escape a value for use inside a JavaScript string literal and in a sed
# replacement: backslash, double quote, newline, and the sed specials & and |.
escape_value() {
  printf '%s' "$1" \
    | awk 'BEGIN { ORS = "" } NR > 1 { print "\\n" } { print }' \
    | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' -e 's/[&|]/\\&/g'
}

files=$(find "$HTML_DIR" -type f \( -name '*.js' -o -name '*.html' \))

for var in $RUNTIME_VARS; do
  eval "value=\${$var:-}"
  escaped=$(escape_value "$value")
  # shellcheck disable=SC2086
  echo "$files" | xargs sed -i "s|__${var}__|${escaped}|g"
done

echo "runtime config applied to $(echo "$files" | wc -l | tr -d ' ') files"
