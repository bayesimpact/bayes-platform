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

Install links pass credentials back to `redirect_uri`. The platform accepts that URI only when:

1. It is a **loopback** URL (`localhost`, `127.0.0.1`, or `::1`) — used by this CLI and other local tools, without needing backoffice registration, or
2. It **exactly matches** a URL on the app's allowlist in the backoffice (Apps → edit app → Allowed install callback URLs).

Register one HTTPS callback per deployed environment (staging, production), for example:

- `http://localhost:3100/auth/bayes/callback`
- `https://site-crawler.staging.bayes.org/auth/bayes/callback`
- `https://site-crawler.bayes.org/auth/bayes/callback`

Match is exact: scheme, host, and path. Do not leave the allowlist empty for web apps that install from a non-loopback host.
