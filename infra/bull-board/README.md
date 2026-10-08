# Queue dashboard (Bull Board)

The platform does not include a queue dashboard. To see the BullMQ jobs
(waiting, active, failed, payload, error) and to retry or remove them, run
[Bull Board](https://github.com/felixmosh/bull-board) as a separate service on
the same Redis. We use the standalone image
[`venatum/bull-board`](https://github.com/Venatum/bull-board-docker): it finds
the queues in Redis and needs no change in the platform.

For counts and durations over time, use the Grafana dashboards. Use Bull Board
to examine or retry one job.

## Local

The dev stack of `infra/database` runs it under the `bull-board` profile, on
the local Redis:

```bash
cd infra/database
docker compose --profile bull-board up -d --no-recreate bull-board
```

Then open http://localhost:3400. There is no login.

## On a cluster

Run it as its own Deployment and Service, in the namespace of the platform.
The Helm chart does not deploy it.

- **Redis**: the image does not read a URL. Set `REDIS_HOST`, `REDIS_PORT` and
  `REDIS_PASSWORD` from the values of `BULLMQ_REDIS_URL`. For a Redis with TLS
  (Memorystore with in-transit encryption), also set `REDIS_USE_TLS=true` and
  `REDIS_TLS_CA` with the CA certificate of `externalRedis.sslCaSecretKey`.
- **Access**: the dashboard can retry, promote and remove jobs. Do not expose
  it without authentication. Use `kubectl port-forward`, or put it behind an
  authenticating proxy (oauth2-proxy, IAP) that only lets operators in.
  `USER_LOGIN` and `USER_PASSWORD` add a basic auth, which is a minimum and
  not a replacement for the proxy.
- **Path**: behind a proxy on a sub-path, set `PROXY_PATH` to that path.

Pin the image version (`venatum/bull-board:<version>`), as for the other
images.
