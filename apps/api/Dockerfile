#
# 🏡 Production Build
#
FROM node:24-bookworm-slim AS build

WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends libc6 && rm -rf /var/lib/apt/lists/*

# Copy source code
COPY apps/api ./apps/api
COPY ./packages ./packages
COPY package-lock.json ./
COPY package.json ./

# Generate the production build. The build script runs "nest build" to compile the application.
# Scope install to API + api-contracts so packages/ui's runtime deps (vite, tailwind, radix, react)
# never enter node_modules/. Frontend workspaces are left on disk but their deps aren't installed.
RUN npm ci \
    --workspace=@caseai-connect/api \
    --workspace=@caseai-connect/api-contracts \
    --include-workspace-root
RUN cd apps/api && npm run build
RUN cd packages/api-contracts && npm run build

# Discard the dev install and reinstall only production deps. A fresh `npm ci --omit=dev`
# produces a cleaner tree than `npm prune --omit=dev`, which leaves extraneous packages
# (e.g. next/react pulled by @repo/jest-config's devDeps) lingering in node_modules.
RUN rm -rf node_modules apps/api/node_modules packages/*/node_modules
RUN npm ci --omit=dev \
    --workspace=@caseai-connect/api \
    --workspace=@caseai-connect/api-contracts \
    --include-workspace-root

# Ensure apps/api/node_modules exists (npm may skip creating it when everything hoists to root).
RUN mkdir -p /app/apps/api/node_modules

#
# 🚀 Runtime Base (shared)
#
FROM node:24-bookworm-slim AS runtime-base

WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends libc6 && rm -rf /var/lib/apt/lists/*

# Set to production environment
ENV NODE_ENV=production

# Copy only the necessary files
COPY --from=build /app/apps/api/dist /app/apps/api/dist
COPY --from=build /app/packages/api-contracts /app/packages/api-contracts
COPY --from=build /app/apps/api/node_modules /app/apps/api/node_modules
COPY --from=build /app/node_modules node_modules

#
# 🚀 API Runtime (no Docling)
#
FROM runtime-base AS api-runtime

CMD ["node", "--enable-source-maps", "/app/apps/api/dist/main.js"]

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
# 🚀 GPU Workers Runtime (Docling enabled)
#
FROM runtime-base AS gpu-workers-runtime

RUN apt-get update && apt-get install -y --no-install-recommends \
  python3 python3-pip python3-venv \
  libxcb1 libgl1 libglib2.0-0 \
  && rm -rf /var/lib/apt/lists/*

# Needed for the docling TS wrapper to execute our custom document_chunker CLI
# inside the container (`apps/api/bin` is not copied into runtime-base).
COPY --from=build /app/apps/api/bin /app/apps/api/bin

# We need the sample PDF for the Docling self-test
# Warning: this test is only run if the environment variable WORKER_DOCLING_SELF_TEST_ENABLED is set to true
COPY --from=build /app/apps/api/test/fixtures/sample.pdf /app/apps/api/bin/sample.pdf

RUN chmod +x /app/apps/api/bin/document_chunker || true
RUN python3 -m venv /opt/docling-venv \
  && /opt/docling-venv/bin/pip install --no-cache-dir --upgrade pip \
  && /opt/docling-venv/bin/pip install --no-cache-dir \
    --index-url https://download.pytorch.org/whl/cu121 \
    torch==2.5.1 \
    torchvision==0.20.1 \
  # rapidocr 3.8.2 ships a broken wheel (missing pytorch/networks/arch_config.yaml); pin until fixed upstream
  && /opt/docling-venv/bin/pip install --no-cache-dir docling "transformers>=4.34.0,<5.0.0" "rapidocr==3.8.1" \
  && /opt/docling-venv/bin/pip install --no-cache-dir \
    llama-index-core \
    llama-index-readers-docling \
    llama-index-node-parser-docling \
  && /opt/docling-venv/bin/python /app/apps/api/bin/document_chunker.py \
    --doc-path /app/apps/api/bin/sample.pdf \
    --output-json /tmp/docling-prewarm.json \
    --max-nodes 1 \
  && ln -s /opt/docling-venv/bin/docling /usr/local/bin/docling

CMD ["node", "--enable-source-maps", "/app/apps/api/dist/workers-main.js"]
