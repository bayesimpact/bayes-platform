#!/bin/sh
# Replace the build-time placeholders with the container environment. Runs
# from the nginx image entrypoint before nginx starts. See the Dockerfile for
# the three variables.
set -eu

HTML_DIR=/usr/share/nginx/html

escape_value() {
  printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' -e 's/[&|]/\\&/g'
}

# The site URL also lives in the sitemap and robots.txt. No trailing slash:
# Astro appends the paths to the site URL.
site_url=$(printf '%s' "${PUBLIC_SITE_URL:-}" | sed 's|/*$||')

files=$(find "$HTML_DIR" -type f \( -name '*.js' -o -name '*.html' -o -name '*.xml' -o -name '*.txt' \))
# shellcheck disable=SC2086
echo "$files" | xargs sed -i \
  -e "s|__PUBLIC_APP_URL__|$(escape_value "${PUBLIC_APP_URL:-}")|g" \
  -e "s|__PUBLIC_API_BASE_URL__|$(escape_value "${PUBLIC_API_BASE_URL:-}")|g" \
  -e "s|https://public-site-url.placeholder.invalid|$(escape_value "$site_url")|g"

echo "runtime config applied to $(echo "$files" | wc -l | tr -d ' ') files"
