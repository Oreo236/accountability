import { WORKER_URL } from './config.js';

const API_KEY_STORAGE = 'deadline-api-key';

function getApiKey() {
  let key = localStorage.getItem(API_KEY_STORAGE);
  if (!key) {
    key = window.prompt('Enter your Deadline API passphrase (the one you set via `wrangler secret put API_SECRET`):') || '';
    localStorage.setItem(API_KEY_STORAGE, key);
  }
  return key;
}

async function call(path, options = {}) {
  const res = await fetch(`${WORKER_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', 'X-Api-Key': getApiKey(), ...(options.headers ?? {}) },
  });
  if (res.status === 401) {
    localStorage.removeItem(API_KEY_STORAGE); // wrong/stale passphrase — ask again next call
    throw new Error(`API ${path} failed: 401 unauthorized (wrong passphrase — try again)`);
  }
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

  getHomework: () => call('/homework'),
  addHomework: (label, dueDate) => call('/homework', { method: 'POST', body: JSON.stringify({ label, dueDate }) }),
  removeHomework: (id) => call('/homework', { method: 'DELETE', body: JSON.stringify({ id }) }),
  markHomeworkDone: (id) => call('/homework/done', { method: 'POST', body: JSON.stringify({ id }) }),
  unmarkHomeworkDone: (id) => call('/homework/done', { method: 'DELETE', body: JSON.stringify({ id }) }),
};
