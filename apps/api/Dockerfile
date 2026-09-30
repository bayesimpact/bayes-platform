#
# Layer order matters for the build cache: dependency manifests are copied and
# installed before the sources, so a code change only re-runs the compile
# steps. The Python/Torch layers of the GPU image depend on the requirements
# files only, never on the application code.
#

#
# 📦 Dependencies of the API (dev + prod), from the manifests only
#
FROM node:24.21.0-trixie-slim AS api-deps

WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends libc6 && rm -rf /var/lib/apt/lists/*

# Every workspace manifest the lockfile knows about, no sources.
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/api-contracts/package.json ./packages/api-contracts/
COPY packages/jest-config/package.json ./packages/jest-config/
COPY packages/typescript-config/package.json ./packages/typescript-config/
COPY packages/ui/package.json ./packages/ui/

# Scope install to API + api-contracts so packages/ui's runtime deps (vite, tailwind, radix, react)
# never enter node_modules/. Frontend workspaces are left on disk but their deps aren't installed.
RUN npm ci \
    --workspace=@caseai-connect/api \
    --workspace=@caseai-connect/api-contracts \
    --include-workspace-root

#
# 📦 Production dependencies of the API, from the manifests only
#
# A fresh `npm ci --omit=dev` produces a cleaner tree than `npm prune --omit=dev`,
# which leaves extraneous packages (e.g. next/react pulled by @repo/jest-config's
# devDeps) lingering in node_modules.
#
FROM node:24.21.0-trixie-slim AS api-prod-deps

WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/api-contracts/package.json ./packages/api-contracts/
COPY packages/jest-config/package.json ./packages/jest-config/
COPY packages/typescript-config/package.json ./packages/typescript-config/
COPY packages/ui/package.json ./packages/ui/

RUN npm ci --omit=dev \
    --workspace=@caseai-connect/api \
    --workspace=@caseai-connect/api-contracts \
    --include-workspace-root

# `next` is an optional peer of @llamaindex/workflow-core (via llamaindex) that npm
# auto-installs, and `sharp` only comes in as an optional dependency of `next`. The API
# uses neither at runtime. npm 11.19 (bundled in node 24.20) ignores `--omit=peer`, so
# drop them explicitly: they pin postcss 8.4.31 and sharp 0.34 with open HIGH CVEs.
RUN rm -rf node_modules/next node_modules/sharp node_modules/@img

# Ensure apps/api/node_modules exists (npm may skip creating it when everything hoists to root).
RUN mkdir -p /app/apps/api/node_modules

#
# 🏡 Production Build
#
FROM api-deps AS build

# Sources, after the install: a code change starts here.
COPY apps/api ./apps/api
COPY ./packages ./packages

# Generate the production build. The build script runs "nest build" to compile the application.
RUN cd apps/api && npm run build
RUN cd packages/api-contracts && npm run build

#
# 🌐 Web front build (only used by the app-runtime target)
#
# Builds apps/web with `/` as public path: the API serves the result at the
# root of its origin (see apps/api/src/common/web-app). No VITE_* tenant value
# is baked in: the API injects the runtime configuration into index.html from
# its own environment, so one image serves every tenant.
#
FROM node:24.21.0-trixie-slim AS web-build

WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/web/package.json ./apps/web/
COPY packages/api-contracts/package.json ./packages/api-contracts/
COPY packages/jest-config/package.json ./packages/jest-config/
COPY packages/typescript-config/package.json ./packages/typescript-config/
COPY packages/ui/package.json ./packages/ui/

RUN npm ci \
    --workspace=@caseai-connect/web \
    --workspace=@caseai-connect/ui \
    --workspace=@caseai-connect/api-contracts \
    --include-workspace-root

COPY apps/web ./apps/web
COPY ./packages ./packages

RUN cd apps/web && npm run build

#
# 🚀 Runtime Base (shared)
#
FROM node:24.21.0-trixie-slim AS runtime-base

WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends libc6 && rm -rf /var/lib/apt/lists/*

# The runtime only calls `node`. The package managers bundled in the Node image
# carry their own dependencies (and CVEs), so drop them.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
  /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
  /opt/yarn-* /usr/local/bin/yarn /usr/local/bin/yarnpkg

# Set to production environment
ENV NODE_ENV=production

# Copy only the necessary files
COPY --from=api-prod-deps /app/node_modules node_modules
COPY --from=api-prod-deps /app/apps/api/node_modules /app/apps/api/node_modules
COPY --from=build /app/packages/api-contracts /app/packages/api-contracts
COPY --from=build /app/apps/api/dist /app/apps/api/dist

#
# 🚀 API Runtime (no Docling)
#
FROM runtime-base AS api-runtime

CMD ["node", "--enable-source-maps", "/app/apps/api/dist/main.js"]

#
# 🚀 App Runtime: API + web front in one image
#
# Same process as api-runtime, plus the built web front served at /. The API
# keeps /api and /public. WEB_APP_DIST_DIR switches the serving on; the API
# image stays API-only.
#
FROM api-runtime AS app-runtime

COPY --from=web-build /app/apps/web/dist /app/apps/web/dist
ENV WEB_APP_DIST_DIR=/app/apps/web/dist

#
# 🚀 CPU Workers Runtime (no Docling)
#
# Runs the same workers entrypoint as the GPU image; which queues it consumes is
# selected at runtime via WORKER_QUEUE_NAMES, and Docling is left disabled
# (DOCUMENT_EXTRACTOR_DOCLING_ENABLED=false). No Python/Torch/Docling layers.
#
FROM runtime-base AS cpu-workers-runtime

CMD ["node", "--enable-source-maps", "/app/apps/api/dist/workers-main.js"]

#
# 🐍 Docling base: Python, Torch (CUDA) and Docling, from the requirements only
#
# Nothing here depends on the application code, so these layers (several GB)
# survive every commit and only rebuild when a requirements file changes.
#
FROM node:24.21.0-trixie-slim AS docling-base

WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
  libc6 \
  python3 python3-pip python3-venv \
  libxcb1 libgl1 libglib2.0-0 \
  && rm -rf /var/lib/apt/lists/*

# Same as runtime-base: no package managers in the runtime image.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
  /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
  /opt/yarn-* /usr/local/bin/yarn /usr/local/bin/yarnpkg

# Python dependencies are pinned in the requirements files (single source of
# truth for both this image and local testing). Torch must be installed first
# from the CUDA index, see requirements-torch.txt.
COPY apps/api/requirements-torch.txt apps/api/requirements-docling.txt apps/api/requirements-embeddings.txt /app/apps/api/

RUN python3 -m venv /opt/docling-venv \
  && /opt/docling-venv/bin/pip install --no-cache-dir --upgrade pip setuptools \
  && /opt/docling-venv/bin/pip install --no-cache-dir -r /app/apps/api/requirements-torch.txt \
  && /opt/docling-venv/bin/pip install --no-cache-dir -r /app/apps/api/requirements-docling.txt \
  && /opt/docling-venv/bin/pip install --no-cache-dir -r /app/apps/api/requirements-embeddings.txt \
  # pip is build-time only. Its vendored msgpack/setuptools copies carry HIGH CVEs
  # that trivy reports, so remove it from the runtime venv once installs are done.
  && /opt/docling-venv/bin/pip uninstall -y pip \
  && ln -s /opt/docling-venv/bin/docling /usr/local/bin/docling

# Needed for the docling TS wrapper to execute our custom document_chunker CLI
# inside the container (`apps/api/bin` is not part of runtime-base).
COPY apps/api/bin /app/apps/api/bin

# We need the sample PDF for the Docling self-test
# Warning: this test is only run if the environment variable WORKER_DOCLING_SELF_TEST_ENABLED is set to true
COPY apps/api/test/fixtures/sample.pdf /app/apps/api/bin/sample.pdf

# Pre-warm: downloads the Docling models into the image. Depends on the
# chunker script and the fixture only.
RUN chmod +x /app/apps/api/bin/document_chunker /app/apps/api/bin/document_embedder || true \
  && /opt/docling-venv/bin/python /app/apps/api/bin/document_chunker.py \
    --doc-path /app/apps/api/bin/sample.pdf \
    --output-json /tmp/docling-prewarm.json \
    --max-nodes 1

# Local embedding models (feature flag "local-embeddings"), baked into the image
# so a worker never downloads weights at runtime. bge-m3 is public. EmbeddingGemma
# is gated on the HuggingFace hub: pass `--secret id=hf_token,env=HF_TOKEN` (a
# token whose account accepted the Gemma licence) to bake it too; without the
# secret the build still succeeds and that model downloads on first use, which
# then needs HF_TOKEN in the worker environment.
ENV HF_HOME=/opt/hf-cache \
    HF_HUB_DISABLE_TELEMETRY=1
RUN --mount=type=secret,id=hf_token,env=HF_TOKEN,required=false \
  LOCAL_EMBEDDING_DEVICE=cpu /opt/docling-venv/bin/python /app/apps/api/bin/document_embedder.py \
    --prewarm --model BAAI/bge-m3 \
  && if [ -n "${HF_TOKEN:-}" ]; then \
       LOCAL_EMBEDDING_DEVICE=cpu /opt/docling-venv/bin/python /app/apps/api/bin/document_embedder.py \
         --prewarm --model google/embeddinggemma-300m; \
     else \
       echo "HF_TOKEN secret not provided: google/embeddinggemma-300m will be downloaded at first use"; \
     fi

#
# 🚀 GPU Workers Runtime (Docling enabled)
#
# The Docling base plus the same runtime files as runtime-base.
#
FROM docling-base AS gpu-workers-runtime

ENV NODE_ENV=production

COPY --from=api-prod-deps /app/node_modules node_modules
COPY --from=api-prod-deps /app/apps/api/node_modules /app/apps/api/node_modules
COPY --from=build /app/packages/api-contracts /app/packages/api-contracts
COPY --from=build /app/apps/api/dist /app/apps/api/dist

CMD ["node", "--enable-source-maps", "/app/apps/api/dist/workers-main.js"]
