#!/bin/sh
# Prepares a worktree environment (the init service of infra/worktree/docker-compose.yaml).
# As root, gives the volumes to the developer. Then, as the developer, installs the dependencies
# when package-lock.json changed, and builds what the dev servers need.
#
# The stamp matters: compose runs this service again at every `up`, and a plain `npm ci` would
# empty node_modules under the running dev servers. FORCE_NPM_CI=1 reinstalls anyway.
set -eu
cd "$WT_PATH"

chown "$WT_UID:$WT_GID" /npm-cache /go-cache \
  node_modules \
  apps/api/node_modules \
  apps/cli/node_modules \
  apps/help/node_modules \
  apps/web/node_modules \
  apps/web-embed/node_modules \
  packages/api-contracts/node_modules \
  packages/jest-config/node_modules \
  packages/ui/node_modules

exec setpriv --reuid="$WT_UID" --regid="$WT_GID" --clear-groups -- sh -eu -c '
  stamp=node_modules/.wt-install-stamp
  wanted="$(sha256sum package-lock.json | cut -d " " -f 1) node-$(node --version) $(uname -m)"
  if [ "${FORCE_NPM_CI:-0}" = 1 ] || [ "$(cat "$stamp" 2>/dev/null)" != "$wanted" ]; then
    npm ci --no-audit --no-fund
    echo "$wanted" > "$stamp"
  fi
  # The API requires the compiled contracts; the web app loads the embed launcher script.
  npm run build -w packages/api-contracts
  npm run build:launcher -w apps/web-embed
'
