#
# Help center (Astro, static), served by nginx.
#
# Build from the repository root:
#   docker build -f apps/help/Dockerfile -t bayes-platform/help .
#
# PUBLIC_APP_URL (the "back to the app" link) is built with a placeholder and
# replaced at container start, so one image serves every install.
#
FROM node:24.20.0-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json turbo.json ./
COPY apps/help ./apps/help
COPY packages ./packages

RUN npm ci \
    --workspace=@caseai-connect/help \
    --include-workspace-root

ENV PUBLIC_APP_URL=__PUBLIC_APP_URL__

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
