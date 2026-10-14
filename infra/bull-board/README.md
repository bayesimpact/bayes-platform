# Queue dashboard (Bull Board)

The platform does not include a queue dashboard. To see the BullMQ jobs
(waiting, active, failed, payload, error) and to retry or remove them, run
[Bull Board](https://github.com/felixmosh/bull-board) as a separate service on
the same Redis. We use the standalone image
[`venatum/bull-board`](https://github.com/Venatum/bull-board-docker): it finds
the queues in Redis and needs no change in the platform.

For counts and durations over time, use the Grafana dashboards. Use Bull Board
to examine or retry one job.

Bull Board has no sign-in of its own (the image only has a shared basic auth).
On a cluster, the sign-in comes from
[oauth2-proxy](https://oauth2-proxy.github.io/oauth2-proxy/) in front of it.

## Local

The dev stack of `infra/database` runs it under the `bull-board` profile, on
the local Redis, without login:

```bash
cd infra/database
docker compose --profile bull-board up -d --no-recreate bull-board
```

Then open http://localhost:3400, or http://bull-board.connect.localhost:8800
when the `router` profile runs.

A worktree environment ([infra/worktree](../worktree/README.md)) has its own
Bull Board on its own Redis, at `http://<name>-bull-board.connect.localhost:8800`.

## On a cluster

The Helm chart does not deploy it. Run one Deployment in the namespace of the
platform, with two containers in the pod:

- **bull-board** (`venatum/bull-board:<version>`) on port 3000, with
  `BULL_BOARD_HOSTNAME=127.0.0.1`: only the proxy of the pod reaches it.
- **oauth2-proxy** (`quay.io/oauth2-proxy/oauth2-proxy:<version>`) on port
  4180, with `OAUTH2_PROXY_UPSTREAMS=http://127.0.0.1:3000`. The Service and
  the ingress point to this port only.

Bull Board settings:

- The image does not read a URL. Set `REDIS_HOST`, `REDIS_PORT` and
  `REDIS_PASSWORD` from the values of `BULLMQ_REDIS_URL`. For a Redis with TLS
  (Memorystore with in-transit encryption), also set `REDIS_USE_TLS=true` and
  `REDIS_TLS_CA` with the CA certificate of `externalRedis.sslCaSecretKey`.
- `NODE_ENV=production` turns off its access log.
- For a read-only root file system, run `node .` instead of the default
  `npm start`, which writes to its cache.

oauth2-proxy settings:

| Variable | Value |
|---|---|
| `OAUTH2_PROXY_PROVIDER` | `oidc` (any OpenID Connect provider), or `google` for Google accounts |
| `OAUTH2_PROXY_OIDC_ISSUER_URL` | with `oidc`: the `OIDC_ISSUER_URL` of the platform |
| `OAUTH2_PROXY_CLIENT_ID`, `OAUTH2_PROXY_CLIENT_SECRET` | a confidential client for the dashboard, from a Secret |
| `OAUTH2_PROXY_REDIRECT_URL` | `https://<dashboard host>/oauth2/callback`, registered on the client |
| `OAUTH2_PROXY_EMAIL_DOMAINS` | the domain of the operators, for example `bayesimpact.org` |
| `OAUTH2_PROXY_COOKIE_SECRET` | 32 random bytes (`openssl rand -base64 32 \| head -c 32`), from a Secret |
| `OAUTH2_PROXY_SCOPE` | `openid profile email` |
| `OAUTH2_PROXY_APPROVAL_PROMPT` | `auto`, else the provider asks for consent at each sign-in |
| `OAUTH2_PROXY_SKIP_PROVIDER_BUTTON` | `true` |
| `OAUTH2_PROXY_HTTP_ADDRESS` | `0.0.0.0:4180` |

oauth2-proxy refuses an account whose email is not verified, like the platform.

Anyone who gets through the proxy can retry, promote and remove jobs. Keep the
email domain strict, and do not expose port 3000.

Pin both image versions, as for the other images.
