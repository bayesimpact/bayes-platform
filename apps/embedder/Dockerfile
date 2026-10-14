# HTTP embedder. Build from the repository root:
#   docker build -f apps/embedder/Dockerfile -t embedder .
# CPU torch by default; for a GPU image pass
#   --build-arg TORCH_INDEX_URL=https://download.pytorch.org/whl/cu128
FROM python:3.12-slim-bookworm

ARG TORCH_INDEX_URL=https://download.pytorch.org/whl/cpu
ARG TORCH_VERSION=2.11.0
ARG EMBEDDER_MODELS=BAAI/bge-m3

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    HF_HOME=/opt/hf-cache \
    HF_HUB_DISABLE_TELEMETRY=1 \
    EMBEDDER_MODELS=${EMBEDDER_MODELS} \
    PORT=3003

WORKDIR /app
COPY apps/embedder/requirements.txt ./
RUN pip install --no-cache-dir --index-url ${TORCH_INDEX_URL} torch==${TORCH_VERSION} \
  && pip install --no-cache-dir -r requirements.txt

COPY apps/embedder/embedder.py apps/embedder/main.py ./

# Bake the weights into the image so a container never downloads them at runtime.
RUN EMBEDDER_DEVICE=cpu python embedder.py --prewarm $(printf -- '--model %s ' $(echo "${EMBEDDER_MODELS}" | tr ',' ' ')) \
  && chmod -R a+rX ${HF_HOME}

USER nobody
EXPOSE 3003
HEALTHCHECK --interval=30s --timeout=5s --start-period=120s \
  CMD python -c "import os, urllib.request; urllib.request.urlopen(f'http://127.0.0.1:{os.environ[\"PORT\"]}/healthz')"
CMD ["sh", "-c", "exec uvicorn main:create_app --factory --host 0.0.0.0 --port ${PORT}"]
