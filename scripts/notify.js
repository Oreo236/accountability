// Run every 15 min by .github/workflows/notify.yml. Reads the live schedule
// (Redis if the user has edited it in-app, otherwise the repo's seed file),
// figures out which tasks need a push right now, and sends it.
import webpush from 'web-push';
import { readFile } from 'node:fs/promises';
import { makeRedis } from './lib/upstash.mjs';
import {
  pickActiveProfile,
  tasksForWeekday,
  zonedNow,
  isStartReminderDue,
  isFollowupDue,
} from '../js/lib/schedule-logic.mjs';

const redis = makeRedis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT || 'mailto:example@example.com',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

async function loadProfiles() {
  const raw = await redis.get('schedule');
  if (raw) return JSON.parse(raw).profiles;
  const seed = JSON.parse(await readFile(new URL('../data/schedule.json', import.meta.url), 'utf8'));
  return seed.profiles;
}

async function alreadySent(date, taskId, kind) {
  const key = `sent:${date}:${taskId}:${kind}`;
  return Boolean(await redis.get(key));
}

async function markSent(date, taskId, kind) {
  await redis.setex(`sent:${date}:${taskId}:${kind}`, 172800, '1'); // 48h, auto-cleans
}

async function send(payload) {
  const subRaw = await redis.get('subscription:default');
  if (!subRaw) {
    console.log('No push subscription stored yet — skipping send:', payload.title);
    return;
  }
  const subscription = JSON.parse(subRaw);
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload));
    console.log('Sent:', payload.title, '-', payload.body);
  } catch (err) {
    console.error('Push send failed:', err.statusCode, err.body || err.message);
  }
}

async function main() {
  const profiles = await loadProfiles();
  const anchor = pickActiveProfile(profiles, new Date().toISOString().slice(0, 10));
  if (!anchor) {
    console.log('No active schedule profile — nothing to do.');
    return;
  }

  const { dateStr, weekday, minutes } = zonedNow(anchor.timezone);
  const profile = pickActiveProfile(profiles, dateStr) ?? anchor;
  const tasks = tasksForWeekday(profile, weekday);
  if (!tasks.length) {
    console.log(`No tasks scheduled for ${dateStr}.`);
    return;
  }

  const doneIds = new Set((await redis.smembers(`done:${dateStr}`)) || []);

  for (const task of tasks) {
    const isDone = doneIds.has(task.id);

    if (!isDone && isStartReminderDue(task, minutes) && !(await alreadySent(dateStr, task.id, 'start'))) {
      await send({
        title: `${task.start} — ${task.label}`,
        body: 'Not later. Now.',
        tag: `${task.id}-start`,
        url: './index.html',
      });
      await markSent(dateStr, task.id, 'start');
    }

    if (!isDone && isFollowupDue(task, minutes) && !(await alreadySent(dateStr, task.id, 'followup'))) {
      await send({
        title: `Still not done: ${task.label}`,
        body: `It's ${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}. You had until ${task.end}.`,
        tag: `${task.id}-followup`,
        url: './index.html',
        urgent: true,
      });
      await markSent(dateStr, task.id, 'followup');
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
