# Bayes platform on Kubernetes

This chart installs the full platform on a Kubernetes cluster:

| Component | What it is | Image |
|---|---|---|
| api | NestJS API, and the web front it serves under `/app` | `app` |
| cpu-workers | async jobs (extraction, crawling, evaluations) | `cpu-workers` |
| gpu-workers | document embeddings with Docling on one GPU (optional) | `gpu-workers` |
| pdf-converter | PDF to page images for image-only LLMs (GCS storage only) | `pdf-converter` |
| web-embed | the embeddable widget and its `launcher.js` | `web-embed` |
| help | the help center | `help` |
| postgresql | bundled Postgres with pgvector (optional) | `pgvector/pgvector` |
| redis | bundled Redis for the job queues (optional) | `redis` |

Two ways to run it:

- **Self-contained**: bundled Postgres and Redis, documents on a volume. The default `values.yaml`. Good for a test cluster or a small install.
- **Managed services**: external Postgres, external Redis, a GCS bucket, a GPU node pool. See `values-managed.example.yaml`.

## Requirements

- Kubernetes 1.27 or newer, `helm` 3.
- An ingress controller (the chart writes Ingress resources for the `nginx` class) and, for TLS, cert-manager with a ClusterIssuer.
- A StorageClass. The bundled Postgres and Redis use `ReadWriteOnce` volumes. The local document storage needs `ReadWriteMany` when the API and the workers run on different nodes.
- An Auth0 tenant. Auth0 is the identity provider of the platform.
- For embeddings: a Google Cloud project with Vertex AI (`gemini-embedding-001`). Self-hosted embedding models are not supported yet.
- For the GPU workers: a node pool with NVIDIA GPUs and the device plugin installed (GKE does this for you).

Minimum cluster size for the self-contained install without GPU: 4 vCPU and 8 GiB of RAM free, 80 GiB of storage.

## Images

Every release publishes the six images, public, on GitHub Container Registry: `ghcr.io/bayesimpact/bayes-platform/<component>:<version>` (for example `.../app:26.09.1`). Every push to `main` also publishes `sha-<short sha>` and `latest`. No credentials are needed to pull them.

The chart is published with the same version as an OCI artifact:

```bash
helm install platform oci://ghcr.io/bayesimpact/charts/bayes-platform --version 0.1.0 -n platform --create-namespace -f my-values.yaml
```

Its `appVersion` is the release tag, and it is the default image tag. Set `global.image.tag` to run another build.

### Build your own

From the repository root, one image per component:

```bash
REGISTRY=ghcr.io/your-org/bayes-platform
TAG=$(git rev-parse --short HEAD)

docker build -f apps/api/Dockerfile --target app-runtime         -t $REGISTRY/app:$TAG .
docker build -f apps/api/Dockerfile --target cpu-workers-runtime -t $REGISTRY/cpu-workers:$TAG .
docker build -f apps/api/Dockerfile --target gpu-workers-runtime -t $REGISTRY/gpu-workers:$TAG .
docker build -f apps/pdf-converter/Dockerfile                    -t $REGISTRY/pdf-converter:$TAG .
docker build -f apps/web-embed/Dockerfile                        -t $REGISTRY/web-embed:$TAG .
docker build -f apps/help/Dockerfile                             -t $REGISTRY/help:$TAG .
```

Push them to your registry, then set `global.image.registry` and `global.image.tag` (and `global.imagePullSecrets` if the registry is private).

The GPU workers image is close to 10 GB (Torch with CUDA, Docling). Build it only if you enable `gpuWorkers`.

The web front is inside the `app` image: the API serves it under `/app` and hands the browser its configuration (`window.__CONFIG__`) from the `WEB_*` environment variables, so the same image works for every install. `web-embed` and `help` are static sites served by nginx, configured the same way when their container starts.

## Secrets

The API and the workers read their secrets from one Kubernetes Secret. Create it before the install:

```bash
kubectl create namespace platform
kubectl -n platform create secret generic platform-secrets \
  --from-literal=MCP_ENCRYPTION_KEY=$(openssl rand -hex 32) \
  --from-literal=AUTH0_M2M_CLIENT_SECRET=... \
  --from-literal=LANGFUSE_SK=... \
  --from-literal=VLLM_MYMODEL_URL=https://... \
  --from-literal=VLLM_MYMODEL_APIKEY=...
```

With external services, add `DATABASE_PASSWORD` and `BULLMQ_REDIS_URL` (a `redis://` URL) to the same Secret.

In production, fill this Secret from your secret store (External Secrets Operator, sealed-secrets) rather than by hand. The bundled Postgres generates its own password and keeps it in `<release>-postgresql`.

## Install

From a checkout of the repository (or use the OCI chart above):

```bash
helm upgrade --install platform deploy/helm/bayes-platform \
  --namespace platform --create-namespace \
  --set global.image.tag=26.09.1 \
  --set secrets.existingSecret=platform-secrets \
  -f my-values.yaml
```

`my-values.yaml` holds at least:

```yaml
urls:
  api: https://platform.example.org        # the API, and the web front under /app
  web: https://platform.example.org/app
  webEmbed: https://embed.platform.example.org
  help: https://help.platform.example.org

config:
  AUTH0_ISSUER_URL: https://your-tenant.eu.auth0.com/
  AUTH0_AUDIENCE: https://your-tenant.eu.auth0.com/api/v2/
  AUTH0_ORGANIZATION_ID: org_xxx
  AUTH0_CLIENT_ID: xxx
  AUTH0_M2M_CLIENT_ID: xxx
  ORGANIZATION_CREATOR_EMAIL_DOMAIN: "@example.org"
  BACKOFFICE_AUTHORIZED_DOMAIN: "@example.org"
  BACKOFFICE_AUTHORIZED_EMAILS: "admin@example.org"
  GOOGLE_VERTEX_PROJECT: my-gcp-project

web:
  env:
    WEB_APP_TITLE: My platform
    WEB_AUTH0_CLIENT_ID: xxx   # the SPA application of the Auth0 tenant

ingress:
  clusterIssuer: letsencrypt-prod
  tls: true
```

Point the three DNS names (`api`, `webEmbed`, `help`) at the ingress controller. In Auth0, add the `web` URL to the allowed callback, logout and web origins of the SPA application.

The database migrations run as a Job after the first install and before every upgrade. To read its output:

```bash
kubectl -n platform logs job/platform-bayes-platform-migrate
```

## Platform administrators

Global roles (`platform_superadmin`, `platform_staff`) are never granted automatically at sign-in: an operator decides who holds them.

- **In the values**: list the emails in `platformSuperadmins`. A Job runs after the migrations, on every install and upgrade, and grants `platform_superadmin` to each of them. The users are created if they never signed in, and linked to their identity at first sign-in, so the first administrator can sign in and create the first organization right away. Adding an email later grants it at the next upgrade. Removing one revokes nothing.
- **Grant, revoke or list by command**, from any api pod:

```bash
kubectl -n platform exec deploy/platform-bayes-platform-api -- \
  node /app/apps/api/dist/scripts/platform-role.js grant --email someone@example.org --role platform_superadmin
```

`revoke` and `list` work the same way.

## Managed services

See `values-managed.example.yaml`. The differences with the default:

- `postgresql.enabled: false` and `externalDatabase.*`. `externalDatabase.ssl` is `require` by default (Cloud SQL refuses plain connections when its `ssl_mode` is `ENCRYPTED_ONLY`); set `verify-full` and `sslCaSecretKey` to check the server certificate. The `vector` extension is created by the first migration when the database user is allowed to; otherwise run `CREATE EXTENSION IF NOT EXISTS vector;` once as an administrator.
- `redis.enabled: false` and `BULLMQ_REDIS_URL` in the Secret.
- `storage.mode: gcs` with `storage.gcs.bucket`. The pods reach the bucket through the service account (`serviceAccount.annotations` for GKE Workload Identity). This mode also enables the `pdf-converter`.
- `gpuWorkers.enabled: true` with `gpuWorkers.gpu.nodeSelector` set to the label of your GPU node pool. The pods request `nvidia.com/gpu: 1` and tolerate the `nvidia.com/gpu` taint.

## Title and theme

The title comes from `web.env.WEB_APP_TITLE`. The logo and favicon are built into the image (`apps/web/public/theme`); a per-install override is not available yet.

## Upgrade

```bash
helm upgrade platform deploy/helm/bayes-platform -n platform --reuse-values --set global.image.tag=$NEW_TAG
```

The migration Job runs before the new pods start. If it fails, the release is not upgraded and the current pods keep running.

## Uninstall

```bash
helm uninstall platform -n platform
```

The volumes of the bundled Postgres, the bundled Redis and the local document storage are kept (`helm.sh/resource-policy: keep`). Delete the PersistentVolumeClaims by hand when you want the data gone.

## Values

See `values.yaml`. Every key is documented in place. The main sections:

| Section | What it controls |
|---|---|
| `global.image` | registry, tag, pull policy, pull secrets |
| `urls` | the public URLs, used by the API (CORS, links) and by the front ends |
| `web.env` | browser configuration of the web front (`WEB_*`), served by the API |
| `secrets` | the Secret with the application secrets |
| `config` | the non-secret environment shared by the API and the workers |
| `postgresql`, `externalDatabase` | bundled or external database |
| `redis`, `externalRedis` | bundled or external Redis |
| `storage` | `local` volume or `gcs` bucket |
| `api`, `cpuWorkers`, `gpuWorkers`, `pdfConverter`, `webEmbed`, `help` | one block per component: replicas, resources, placement |
| `migrations` | the migration Job |
| `ingress` | class, annotations, cert-manager issuer, TLS |

## Limits of this version

- Auth0 is the only identity provider.
- Embeddings need Vertex AI. LLM calls can go to any OpenAI-compatible endpoint (`VLLM_*` secrets).
- The local document storage has no S3 backend. Use the `gcs` mode or a `ReadWriteMany` volume.
- The API has no health route yet, so its probes check the TCP port.
