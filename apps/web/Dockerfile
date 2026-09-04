# check=skip=SecretsUsedInArgOrEnv
# (the ENV values below are placeholders, not secrets)
#
# Web front end (Vite + React), served by nginx.
#
# Build from the repository root:
#   docker build -f apps/web/Dockerfile -t bayes-platform/web .
#
# Vite inlines VITE_* variables at build time. To ship one image for every
# install, the deployment-specific variables are built with a placeholder
# (__VITE_API_URL__ ...) that docker/40-runtime-config.sh replaces with the
# container environment when nginx starts. See docker/40-runtime-config.sh for
# the list. Variables that are not in that list stay build-time build args.
#
FROM node:24.20.0-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json turbo.json ./
COPY apps/web ./apps/web
COPY packages ./packages

# Scope the install to the web app and its two workspace dependencies.
RUN npm ci \
    --workspace=@caseai-connect/web \
    --workspace=@caseai-connect/ui \
    --workspace=@caseai-connect/api-contracts \
    --include-workspace-root

# Deployment-specific values: placeholders, replaced at container start.
ENV VITE_API_URL=__VITE_API_URL__ \
    VITE_APP_TITLE=__VITE_APP_TITLE__ \
    VITE_AUTH0_DOMAIN=__VITE_AUTH0_DOMAIN__ \
    VITE_AUTH0_CLIENT_ID=__VITE_AUTH0_CLIENT_ID__ \
    VITE_AUTH0_AUDIENCE=__VITE_AUTH0_AUDIENCE__ \
    VITE_AUTH0_ORGANIZATION_ID=__VITE_AUTH0_ORGANIZATION_ID__ \
    VITE_AGENT_EMBED_URL=__VITE_AGENT_EMBED_URL__ \
    VITE_HELP_CENTER_URL=__VITE_HELP_CENTER_URL__ \
    VITE_HELP_AGENT_EMBED_URL=__VITE_HELP_AGENT_EMBED_URL__ \
    VITE_HELP_AGENT_EMBED_TOKEN=__VITE_HELP_AGENT_EMBED_TOKEN__ \
    VITE_HELP_AGENT_EMBED_COLOR=__VITE_HELP_AGENT_EMBED_COLOR__ \
    VITE_HELP_AGENT_EMBED_HINT=__VITE_HELP_AGENT_EMBED_HINT__

# Product defaults, fixed at build time (JSON payloads, timeouts).
ARG VITE_API_TIMEOUT_MS
ARG VITE_DEFAULT_CONVERSATION_AGENT_PROMPT
ARG VITE_DEFAULT_EXTRACTION_AGENT_PROMPT
ARG VITE_DEFAULT_EXTRACTION_AGENT_SCHEMA
ARG VITE_DEFAULT_FORM_AGENT_PROMPT
ARG VITE_DEFAULT_FORM_AGENT_SCHEMA

# turbo builds the workspace dependencies (ui, api-contracts) first.
RUN npx turbo run build --filter=@caseai-connect/web

#
# Runtime: nginx, non root, port 8080.
#
FROM nginxinc/nginx-unprivileged:1.27-alpine

COPY apps/web/docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY apps/web/docker/40-runtime-config.sh /docker-entrypoint.d/40-runtime-config.sh
COPY --from=build /app/apps/web/dist /usr/share/nginx/html

# The runtime config script rewrites the built files in place.
USER root
RUN chmod +x /docker-entrypoint.d/40-runtime-config.sh \
    && chown -R nginx:nginx /usr/share/nginx/html
USER nginx

EXPOSE 8080
