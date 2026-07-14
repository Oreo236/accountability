// Run every ~6h by .github/workflows/listings.yml.
// Fetches the community new-grad listings source, diffs against the committed
// snapshot, pushes a batched notification for anything new, seeds Redis
// applications as not_applied for new URLs, and commits the updated snapshot.
import { readFile, writeFile } from 'node:fs/promises';
import webpush from 'web-push';
import { makeRedis } from './lib/upstash.mjs';
import { parseListings } from './lib/markdown-table-parser.mjs';

const SOURCE_URL = 'https://github.com/speedyapply/2027-SWE-College-Jobs/raw/refs/heads/main/NEW_GRAD_USA.md';
const SNAPSHOT_PATH = new URL('../data/listings.json', import.meta.url);

const redis = makeRedis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT || 'mailto:example@example.com',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

async function sendBatched(newListings) {
  const subRaw = await redis.get('subscription:default');
  if (!subRaw) {
    console.log('No push subscription stored yet — skipping listings notification.');
    return;
  }
  const subscription = JSON.parse(subRaw);

  const payload =
    newListings.length === 1
      ? {
          title: `New: ${newListings[0].company} — ${newListings[0].position}`,
          body: newListings[0].location,
        }
      : {
          title: `${newListings.length} new grad postings`,
          body: newListings
            .slice(0, 5)
            .map((l) => `${l.company} — ${l.position}`)
            .join('\n') + (newListings.length > 5 ? `\n+${newListings.length - 5} more` : ''),
        };

  try {
    await webpush.sendNotification(subscription, JSON.stringify({ ...payload, url: './index.html#jobs', tag: 'listings' }));
    console.log('Sent listings notification:', payload.title);
  } catch (err) {
    console.error('Push send failed:', err.statusCode, err.body || err.message);
  }
}

async function upsertNotApplied(urls) {
  const raw = await redis.get('applications');
  const applications = raw ? JSON.parse(raw) : {};
  let changed = false;
  for (const url of urls) {
    if (!applications[url]) {
      applications[url] = { status: 'not_applied', appliedDate: null, notes: '', lastUpdated: new Date().toISOString() };
      changed = true;
    }
  }
  if (changed) await redis.set('applications', JSON.stringify(applications));
}

async function main() {
  const res = await fetch(SOURCE_URL);
  if (!res.ok) throw new Error(`Failed to fetch source: ${res.status}`);
  const markdown = await res.text();
  const listings = parseListings(markdown);
  console.log(`Parsed ${listings.length} listings.`);

  const previous = JSON.parse(await readFile(SNAPSHOT_PATH, 'utf8'));
  const previousUrls = new Set(previous.listings.map((l) => l.url));
  const newListings = listings.filter((l) => !previousUrls.has(l.url));

  console.log(`${newListings.length} new listings since last run.`);

  if (newListings.length) {
    await sendBatched(newListings);
    await upsertNotApplied(newListings.map((l) => l.url));
  }

  await writeFile(
    SNAPSHOT_PATH,
    JSON.stringify({ updatedAt: new Date().toISOString(), listings }, null, 2) + '\n'
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
