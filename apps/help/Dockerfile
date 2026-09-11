#
# Help center (Astro, static), served by nginx.
#
# Build from the repository root:
#   docker build -f apps/help/Dockerfile -t bayes-platform/help .
#
# The per-install URLs are built with placeholders and replaced at container
# start (docker/40-runtime-config.sh), so one image serves every install:
#   PUBLIC_APP_URL       the "back to the app" link
#   PUBLIC_API_BASE_URL  the API base URL shown on the public API pages
#   PUBLIC_SITE_URL      canonical links and sitemap; Astro requires a valid
#                        URL at build time, hence a placeholder host
#
FROM node:24.20.0-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json turbo.json ./
COPY apps/help ./apps/help
COPY packages ./packages

RUN npm ci \
    --workspace=@caseai-connect/help \
    --include-workspace-root

ENV PUBLIC_APP_URL=__PUBLIC_APP_URL__ \
    PUBLIC_API_BASE_URL=__PUBLIC_API_BASE_URL__ \
    PUBLIC_SITE_URL=https://public-site-url.placeholder.invalid

RUN npx turbo run build --filter=@caseai-connect/help

#
# Runtime: nginx, non root, port 8080.
#
FROM nginxinc/nginx-unprivileged:1.27-alpine

COPY apps/help/docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY apps/help/docker/40-runtime-config.sh /docker-entrypoint.d/40-runtime-config.sh
COPY --from=build /app/apps/help/dist /usr/share/nginx/html

USER root
RUN chmod +x /docker-entrypoint.d/40-runtime-config.sh \
    && chown -R nginx:nginx /usr/share/nginx/html
USER nginx

EXPOSE 8080
