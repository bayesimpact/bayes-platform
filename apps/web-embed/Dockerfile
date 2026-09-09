#
# Embed front end (the widget loaded in an iframe on partner pages, plus the
# launcher.js script tag), served by nginx.
#
# Build from the repository root:
#   docker build -f apps/web-embed/Dockerfile -t bayes-platform/web-embed .
#
# VITE_API_URL is built with a placeholder and replaced at container start
# (see docker/40-runtime-config.sh), so one image serves every install.
#
FROM node:24.20.0-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json turbo.json ./
COPY apps/web-embed ./apps/web-embed
COPY packages ./packages

RUN npm ci \
    --workspace=@caseai-connect/web-embed \
    --workspace=@caseai-connect/api-contracts \
    --include-workspace-root

ENV VITE_API_URL=__VITE_API_URL__

# Builds the SPA (dist/) and the launcher IIFE (dist-launcher/).
RUN npx turbo run build --filter=@caseai-connect/web-embed

#
# Runtime: nginx, non root, port 8080.
#
FROM nginxinc/nginx-unprivileged:1.27-alpine

COPY apps/web-embed/docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY apps/web-embed/docker/40-runtime-config.sh /docker-entrypoint.d/40-runtime-config.sh
COPY --from=build /app/apps/web-embed/dist /usr/share/nginx/html
# The launcher is what partner pages load with a <script> tag: /launcher.js.
COPY --from=build /app/apps/web-embed/dist-launcher/launcher.iife.js /usr/share/nginx/html/launcher.js

USER root
RUN chmod +x /docker-entrypoint.d/40-runtime-config.sh \
    && chown -R nginx:nginx /usr/share/nginx/html
USER nginx

EXPOSE 8080
