import { WORKER_URL } from './config.js';

async function call(path, options = {}) {
  const res = await fetch(`${WORKER_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers ?? {}) },
  });
  if (!res.ok) {
    throw new Error(`API ${path} failed: ${res.status} ${await res.text().catch(() => '')}`);
  }
  return res.status === 204 ? null : res.json();
}

export const api = {
  getSchedule: () => call('/schedule'),
  saveSchedule: (profiles) => call('/schedule', { method: 'POST', body: JSON.stringify({ profiles }) }),

  getDone: (date) => call(`/done?date=${encodeURIComponent(date)}`),
  markDone: (date, taskId) => call('/done', { method: 'POST', body: JSON.stringify({ date, taskId }) }),
  unmarkDone: (date, taskId) => call('/done', { method: 'DELETE', body: JSON.stringify({ date, taskId }) }),

  getStreak: () => call('/streak'),

  saveSubscription: (subscription) => call('/subscribe', { method: 'POST', body: JSON.stringify({ subscription }) }),

  getApplications: () => call('/applications'),
  setApplicationStatus: (url, status, notes) =>
    call('/applications', { method: 'POST', body: JSON.stringify({ url, status, notes }) }),
};
