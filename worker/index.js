// Cloudflare Worker: the only thing allowed to hold the Upstash Redis REST
// token. The frontend (GitHub Pages) never talks to Upstash directly — it
// calls these endpoints instead. See SETUP.md for deploy steps.
import {
  pickActiveProfile,
  tasksForWeekday,
  zonedNow,
} from '../js/lib/schedule-logic.mjs';

const SEED_SCHEDULE_URL =
  'https://raw.githubusercontent.com/Oreo236/accountability/main/data/schedule.json';

function corsHeaders(env) {
  return {
    'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function json(env, data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(env) },
  });
}

async function redis(env, ...command) {
  const res = await fetch(
    `${env.UPSTASH_REDIS_REST_URL}/${command.map((c) => encodeURIComponent(c)).join('/')}`,
    { headers: { Authorization: `Bearer ${env.UPSTASH_REDIS_REST_TOKEN}` } }
  );
  const body = await res.json();
  if (!res.ok) throw new Error(`redis ${command[0]} failed: ${JSON.stringify(body)}`);
  return body.result;
}

async function getSchedule(env) {
  const raw = await redis(env, 'GET', 'schedule');
  if (raw) return JSON.parse(raw);

  const seedRes = await fetch(SEED_SCHEDULE_URL);
  const seed = await seedRes.json();
  await redis(env, 'SET', 'schedule', JSON.stringify(seed));
  return seed;
}

async function handleSchedule(request, env) {
  if (request.method === 'GET') {
    return json(env, await getSchedule(env));
  }
  if (request.method === 'POST') {
    const { profiles } = await request.json();
    if (!Array.isArray(profiles)) return json(env, { error: 'profiles must be an array' }, 400);
    await redis(env, 'SET', 'schedule', JSON.stringify({ profiles }));
    return json(env, { ok: true });
  }
  return json(env, { error: 'method not allowed' }, 405);
}

async function handleDone(request, env, url) {
  if (request.method === 'GET') {
    const date = url.searchParams.get('date');
    if (!date) return json(env, { error: 'date required' }, 400);
    const members = (await redis(env, 'SMEMBERS', `done:${date}`)) || [];
    return json(env, { doneTaskIds: members });
  }
  if (request.method === 'POST') {
    const { date, taskId } = await request.json();
    if (!date || !taskId) return json(env, { error: 'date and taskId required' }, 400);
    await redis(env, 'SADD', `done:${date}`, taskId);
    await redis(env, 'EXPIRE', `done:${date}`, '172800'); // 48h
    return json(env, { ok: true });
  }
  if (request.method === 'DELETE') {
    const { date, taskId } = await request.json();
    if (!date || !taskId) return json(env, { error: 'date and taskId required' }, 400);
    await redis(env, 'SREM', `done:${date}`, taskId);
    return json(env, { ok: true });
  }
  return json(env, { error: 'method not allowed' }, 405);
}

async function handleStreak(env) {
  const { profiles } = await getSchedule(env);
  if (!profiles?.length) return json(env, { streak: 0 });

  // Use the timezone of whatever profile is active "today" as the reference clock.
  const anchor = pickActiveProfile(profiles, new Date().toISOString().slice(0, 10));
  const timezone = anchor?.timezone ?? 'UTC';

  let streak = 0;
  let cursor = new Date();
  for (let i = 0; i < 60; i++) {
    const { dateStr, weekday } = zonedNow(timezone, cursor);
    const profile = pickActiveProfile(profiles, dateStr);
    const tasks = profile ? tasksForWeekday(profile, weekday) : [];

    if (tasks.length) {
      const done = new Set((await redis(env, 'SMEMBERS', `done:${dateStr}`)) || []);
      const allDone = tasks.every((t) => done.has(t.id));
      if (!allDone) {
        if (i === 0) { cursor = new Date(cursor.getTime() - 86400000); continue; } // today in progress, don't break streak yet
        break;
      }
      streak += 1;
    }
    cursor = new Date(cursor.getTime() - 86400000);
  }
  return json(env, { streak });
}

async function handleSubscribe(request, env) {
  if (request.method !== 'POST') return json(env, { error: 'method not allowed' }, 405);
  const { subscription } = await request.json();
  if (!subscription) return json(env, { error: 'subscription required' }, 400);
  await redis(env, 'SET', 'subscription:default', JSON.stringify(subscription));
  return json(env, { ok: true });
}

async function handleApplications(request, env) {
  if (request.method === 'GET') {
    const raw = await redis(env, 'GET', 'applications');
    return json(env, { applications: raw ? JSON.parse(raw) : {} });
  }
  if (request.method === 'POST') {
    const { url: jobUrl, status, notes } = await request.json();
    if (!jobUrl || !status) return json(env, { error: 'url and status required' }, 400);
    const raw = await redis(env, 'GET', 'applications');
    const applications = raw ? JSON.parse(raw) : {};
    applications[jobUrl] = {
      status,
      notes: notes ?? applications[jobUrl]?.notes ?? '',
      appliedDate: applications[jobUrl]?.appliedDate ?? (status === 'applied' ? new Date().toISOString() : null),
      lastUpdated: new Date().toISOString(),
    };
    await redis(env, 'SET', 'applications', JSON.stringify(applications));
    return json(env, { ok: true });
  }
  return json(env, { error: 'method not allowed' }, 405);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(env) });
    }

    try {
      if (url.pathname === '/schedule') return await handleSchedule(request, env);
      if (url.pathname === '/done') return await handleDone(request, env, url);
      if (url.pathname === '/streak') return await handleStreak(env);
      if (url.pathname === '/subscribe') return await handleSubscribe(request, env);
      if (url.pathname === '/applications') return await handleApplications(request, env);
      return json(env, { error: 'not found' }, 404);
    } catch (err) {
      return json(env, { error: err.message }, 500);
    }
  },
};
