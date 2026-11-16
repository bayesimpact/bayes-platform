# The workers of a worktree environment, with Docling (see docker-compose.yaml, service workers).
# The same Node image as the other services, plus the Python environment that
# apps/api/bin/document_chunker looks for at /opt/docling-venv. The production GPU image
# (docling-base in apps/api/Dockerfile) installs the same requirements-docling.txt, but on the
# CUDA build of Torch: here it is the CPU build, which also builds natively on ARM Macs.
# The build context is the repository root.
FROM node:24.21.0-trixie-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
  python3 python3-pip python3-venv \
  libxcb1 libgl1 libglib2.0-0 \
  && rm -rf /var/lib/apt/lists/*

COPY apps/api/requirements-docling.txt /tmp/docling/requirements-docling.txt

# Same Torch version as apps/api/requirements-torch.txt, from the CPU index.
RUN python3 -m venv /opt/docling-venv \
  && /opt/docling-venv/bin/pip install --no-cache-dir --upgrade pip setuptools \
  && /opt/docling-venv/bin/pip install --no-cache-dir \
    --index-url https://download.pytorch.org/whl/cpu \
    torch==2.11.0 torchvision==0.26.0 \
  && /opt/docling-venv/bin/pip install --no-cache-dir -r /tmp/docling/requirements-docling.txt

# The workers run as the developer's uid, unknown at build time: the model caches are open to
# every user, so a model the pre-warm missed can still be downloaded at run time.
ENV HF_HOME=/opt/docling-cache/huggingface
# That uid has no entry in /etc/passwd, and the model loaders ask getpass for a user name, which
# then fails with "No username set in the environment": getpass reads USER first.
ENV USER=developer

# Pre-warm, as in apps/api/Dockerfile: the Docling models, then RapidOCR's (forced OCR), go into
# the image, so the first document does not wait for them.
COPY apps/api/bin/document_chunker.py /tmp/docling/document_chunker.py
COPY apps/api/test/fixtures/sample.pdf /tmp/docling/sample.pdf
RUN mkdir -p "$HF_HOME" \
  && /opt/docling-venv/bin/python /tmp/docling/document_chunker.py \
    --doc-path /tmp/docling/sample.pdf --output-json /tmp/docling/prewarm.json --max-nodes 1 \
  && /opt/docling-venv/bin/python /tmp/docling/document_chunker.py \
    --doc-path /tmp/docling/sample.pdf --output-json /tmp/docling/prewarm-ocr.json --max-nodes 1 \
    --force-full-page-ocr \
  && chmod -R a+rwX /opt/docling-cache \
    "$(/opt/docling-venv/bin/python -c 'import pathlib, rapidocr; print(pathlib.Path(rapidocr.__file__).parent / "models")')" \
  && rm -rf /tmp/docling
