# bayes CLI

Install an app from the terminal. The command opens the install page in the browser. After you approve, it prints the client id and client secret once. Save the secret. It cannot be retrieved later.

## Setup

From the repository root, after `npm ci`:

```bash
npm run build --workspace @caseai-connect/cli
```

That compiles `apps/cli` to `dist/main.js`, which is not committed. `npm ci` links the package bin, so you run it with `npx bayes` from the repository root.

## Install an app

The web app and the API must already be running, and you must be logged in.

```bash
npx bayes apps install <slug> --frontend https://connect.localhost:5173
```

`--frontend` is the web app origin, with no path. Set `BAYES_FRONTEND_URL` instead if you do not want to pass it each time.

`npm link --workspace @caseai-connect/cli` puts `bayes` on your `PATH`. A checkout does not need that.

## Install callback URLs (`redirect_uri`)

After approval, the browser redirects to `redirect_uri` with a short-lived one-time `code` and `state` only. The client secret is never put in the URL. The CLI (and deployed apps) exchange that code for credentials with `POST /apps/v1/install/exchange`.

The platform accepts `redirect_uri` when:

1. It is a **loopback** URL (`localhost`, `*.localhost`, `127.0.0.1`, or `::1`) — used by this CLI and other local tools, without needing backoffice registration, or
2. It **exactly matches** an **https** URL on the app's allowlist in the backoffice (Apps → edit app → Allowed install callback URLs).

Register one HTTPS callback per deployed environment (staging, production), for example:

- `https://site-crawler.staging.bayes.org/auth/bayes/callback`
- `https://site-crawler.bayes.org/auth/bayes/callback`

Local loopback examples that need no allowlist entry: `http://localhost:3100/auth/bayes/callback`, `http://acme.localhost/auth/bayes/callback`.

Match is exact: scheme, host, and path. Do not leave the allowlist empty for web apps that install from a non-loopback host.

Local installs often need an explicit API origin when the web app and API are on different hosts:

```bash
npx bayes apps install <slug> \
  --frontend https://connect.localhost:5173 \
  --api http://localhost:3000/api
```

`--api` defaults to `BAYES_API_URL`, or `<frontend>/api` when unset.
