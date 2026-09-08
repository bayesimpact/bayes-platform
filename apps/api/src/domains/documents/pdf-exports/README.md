# PDF exports TTL sweep

`apps/pdf-converter` writes the PDFs it renders under `tmp/pdf-exports/<uuid>/<file>.pdf` in the platform bucket and hands the caller a short-lived signed download URL. It never deletes anything. This folder is the other half of that contract: a BullMQ-scheduled sweep, running in the workers, that deletes the exports once their URLs have expired.

GCS lifecycle rules only express whole days, so they cannot enforce a TTL measured in minutes. The sweep is what actually bounds how long an export lives.

## Contract with the converter

Both sides read the same env var names, so they must be set to the same values in every environment:

| Env var | Default | Used by |
|---------|---------|---------|
| `GCS_STORAGE_BUCKET_NAME` | (unset) | both: the bucket exports are written to and swept from |
| `PDF_EXPORT_TMP_PREFIX` | `tmp/pdf-exports/` | both: the folder exports live in |
| `PDF_EXPORT_TTL_MINUTES` | `15` | both: lifetime of a signed download URL |
| `PDF_EXPORT_SWEEP_INTERVAL_SECONDS` | `300` | workers only: how often the sweep runs |
| `PDF_EXPORTS_SWEEP_QUEUE_NAME` | `pdf-exports-sweep` | workers only: the sweep queue name, must match the name listed in `WORKER_QUEUE_NAMES` |

If the converter signs URLs for longer than `PDF_EXPORT_TTL_MINUTES`, the sweep can delete an object a user still holds a valid URL for.

Without `GCS_STORAGE_BUCKET_NAME` the sweep has nothing to sweep (local setups store files on disk through `LocalStorageService`), so the bucket provider yields `null` and each run returns immediately.

## Timing guarantees

An export is deleted only once it is older than `PDF_EXPORT_TTL_MINUTES` plus a 60 second grace period (`PDF_EXPORTS_DELETE_GRACE_SECONDS`), which gives two bounds:

- A signed URL always resolves for its whole lifetime, with the grace period to spare. The object outlives the URL, never the other way round.
- An export lives at most TTL + grace + one sweep interval, since an object that expires just after a run waits for the next one. With the defaults that is under 21 minutes.

Each run lists at most 20 pages of 1000 objects (`PDF_EXPORTS_SWEEP_MAX_PAGES_PER_RUN`, `PDF_EXPORTS_SWEEP_PAGE_SIZE`) and deletes 20 objects at a time. A backlog larger than that is drained over the following runs rather than in one long job.

Objects whose `timeCreated` is missing or unparseable are counted and left alone: deleting an object of unknown age could take out a live export.

## Deployment

- The workers' service account needs `storage.objects.list` and `storage.objects.delete` on the bucket (`roles/storage.objectAdmin`, or a custom role with those two permissions plus the ones the API already needs).
- Production `WORKER_QUEUE_NAMES` must include `pdf-exports-sweep` on exactly one worker pool. The queue is registered in `worker-pools.ts` and mapped to `PdfExportsSweepWorkersModule` in `workers-app.module.ts`, so a pool that does not list it never loads the module.
- The scheduler is idempotent: every worker that loads the module upserts the same job scheduler id, so running several instances still produces one sweep per interval.
