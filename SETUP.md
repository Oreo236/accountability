# Setup

Everything is scaffolded. These are the steps only you can do (accounts, secrets, and the one-time device install).

> **Already deployed the Worker once?** `worker/index.js` gained new routes (homework tracker) and an auth check since your first deploy. Run `cd worker && wrangler deploy` again, then `wrangler secret put API_SECRET` (step 4.4) to pick up both.

## 1. Install dependencies locally

```
npm install
```

## 2. Generate VAPID keys

```
npm run generate-vapid
```

This prints a public and private key pair. Keep this terminal output — you'll paste both values into two different places below (frontend config + GitHub secret), and the private key nowhere else.

Edit [js/config.js](js/config.js) and paste the **public** key into `VAPID_PUBLIC_KEY`.

## 3. Create the Upstash Redis database

1. Go to [console.upstash.com](https://console.upstash.com) → sign up free → **Create Database**.
2. Name it anything (e.g. `deadline`), pick the region closest to you, **Regional** type (not Global — free tier).
3. Once created, open the database → **REST API** tab. Copy:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`

You'll paste these in two places: as Cloudflare Worker secrets (step 4) and as GitHub Actions secrets (step 5) — the Worker and the Actions scripts both talk to Redis, but the browser never does.

## 4. Deploy the Cloudflare Worker (the only thing holding your Redis token)

1. Free account at [dash.cloudflare.com](https://dash.cloudflare.com) if you don't have one.
2. Install wrangler and log in:
   ```
   npm install -g wrangler
   wrangler login
   ```
3. From the `worker/` directory:
   ```
   cd worker
   wrangler deploy
   ```
   This prints your Worker URL, e.g. `https://deadline-api.yourname.workers.dev`.
4. Set the Redis secrets and an API secret on the Worker (it'll prompt you to paste each value):
   ```
   wrangler secret put UPSTASH_REDIS_REST_URL
   wrangler secret put UPSTASH_REDIS_REST_TOKEN
   wrangler secret put API_SECRET
   ```
   For `API_SECRET`, paste any random passphrase — e.g. generate one with `openssl rand -hex 16`. This is a lightweight gate so a stranger poking at your Worker URL directly (bypassing the browser/CORS entirely) can't read or write your data. It's not bulletproof security, just a lock on an otherwise-open door.
5. Open [worker/wrangler.toml](worker/wrangler.toml) and confirm `ALLOWED_ORIGIN` matches your GitHub Pages URL exactly (set up in step 6) — no trailing slash. Re-run `wrangler deploy` if you change it.
6. Back in [js/config.js](js/config.js), paste your Worker URL into `WORKER_URL`.

The passphrase itself does **not** go in `config.js` — that file is committed to your public repo, and hardcoding it there would defeat the point. Instead, the first time the app calls the Worker it'll pop up a one-time prompt asking for the passphrase, then remembers it in that browser's local storage only. Enter the same value you gave `wrangler secret put API_SECRET`. If you ever mistype it, the app clears the stored value automatically on a 401 and asks again next time.

## 5. Add GitHub Actions secrets

In your repo → **Settings → Secrets and variables → Actions → New repository secret**, add:

| Secret | Value |
|---|---|
| `UPSTASH_REDIS_REST_URL` | from step 3 |
| `UPSTASH_REDIS_REST_TOKEN` | from step 3 |
| `VAPID_PUBLIC_KEY` | from step 2 |
| `VAPID_PRIVATE_KEY` | from step 2 (only lives here and in your local terminal history — never in frontend code) |
| `VAPID_CONTACT_EMAIL` | any email you control, e.g. `you@example.com` (required by the push spec as a contact point) |

## 6. Commit, push, enable GitHub Pages

```
git add js/config.js worker/wrangler.toml
git commit -m "Configure worker URL and VAPID public key"
git push
```

Then in your repo → **Settings → Pages** → Source: **Deploy from a branch** → Branch: `main`, folder: `/ (root)` → Save.

GitHub gives you the URL (something like `https://oreo236.github.io/accountability/`). If it doesn't exactly match what you put in `ALLOWED_ORIGIN` in step 4, update `worker/wrangler.toml` and redeploy the Worker.

## 7. Install on your iPhone

1. Open the GitHub Pages URL in **Safari** on your iPhone (must be Safari, not Chrome — iOS only allows installable PWAs from Safari).
2. Tap the **Share** icon → **Add to Home Screen** → Add.
3. Open the app from the **home screen icon** (not the Safari tab — push only works from the installed app).
4. Tap **Enable notifications** on the Today tab and accept the permission prompt.

That's it — GitHub Actions checks every 15 minutes and will push a reminder at each task's start time, and a follow-up if it's still unmarked ~30 minutes after the task's end time.

## Updating your schedule later (e.g. when the fall semester starts)

No code changes needed — use the **Edit Schedule** tab in the app. Give the new schedule a different profile name (e.g. `fall`) and set its "active from" date to whenever the semester starts; it'll take over automatically on that date. Nothing in `.github/workflows/notify.yml` needs to change.
