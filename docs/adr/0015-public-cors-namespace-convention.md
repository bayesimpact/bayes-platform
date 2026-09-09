# ADR 0015: Public CORS Namespace Convention over Per-Controller Declaration

* **Status**: Accepted
* **Date**: 2026-08-24
* **Deciders**: engineering (jdoucy)
* **Scope**: API CORS policy selection — `apps/api/src/config/cors.ts`, `PUBLIC_PATH_PREFIX` in api-contracts

---

## Decision

The API runs two CORS policies, selected per request by a path prefix (see #366): paths under the public namespace reflect the request origin (embed widget, secured by `EmbedTokenGuard`), every other path pins origins to `FRONTEND_URL`.

The public namespace is a **convention**: every open-CORS endpoint lives under the `PUBLIC_PATH_PREFIX` constant exported by `api-contracts`. Route files build their paths from that constant, and the CORS delegate matches on it. One source of truth, no duplicated string between route definitions and bootstrap.

## Rejected alternative: per-controller CORS declaration

A `@PublicCors()` decorator on the controller was considered and rejected. Two distinct points:

- **Request-time enforcement is impossible.** The `OPTIONS` preflight never reaches the controller handler, so nothing attached to the controller at request time (guard, interceptor, metadata read by a guard) runs on it. The CORS decision is always taken on the raw path by a middleware, before Nest routing.
- **Bootstrap-time collection works but does not pay for itself.** The viable variant scans decorated controllers at startup (`DiscoveryService`/`MetadataScanner`), collects their paths, and hands the list to the middleware delegate. Its end product is exactly what the convention already provides — a list of path prefixes consulted by the delegate — at the cost of reflection machinery, for two controllers.

Revisit if an endpoint ever needs open CORS **outside** the public namespace. That change breaks the convention and justifies the per-controller declaration in its own ADR.

## Consequences

- A new public endpoint must define its route under `PUBLIC_PATH_PREFIX` in api-contracts. Nothing else to register: CORS follows the path.
- Renaming the public namespace is a one-constant change, but it is a breaking change for deployed embed snippets — do not rename it casually.
- `main.ts` knows no path strings; it only wires `buildCorsOptionsDelegate(frontendUrls)`.
