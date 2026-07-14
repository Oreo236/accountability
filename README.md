# Deadline

An installable PWA that pushes real lock-screen reminders for a daily schedule (LeetCode, gym, deep work, algorithms prep) and follows up if a task isn't marked done — plus a Jobs tab that tracks new-grad SWE postings and your application status.

- **Frontend**: static PWA, hosted free on GitHub Pages.
- **Push**: Web Push + VAPID, triggered by GitHub Actions on a 15-minute cron (no server to keep running).
- **State**: Upstash Redis (free tier), accessed only through a small Cloudflare Worker — the browser never holds the Redis token directly.
- **Schedule**: stored as data ([data/schedule.json](data/schedule.json)), editable in-app under "Edit Schedule" — no code changes or redeploys needed when your routine changes.
- **Jobs tab**: scrapes [speedyapply/2027-SWE-College-Jobs](https://github.com/speedyapply/2027-SWE-College-Jobs) every 6 hours, diffs against the last snapshot, and pushes a notification for new postings.

See [SETUP.md](SETUP.md) for the one-time setup steps (Upstash, VAPID keys, Cloudflare Worker, GitHub Pages, iOS install).
