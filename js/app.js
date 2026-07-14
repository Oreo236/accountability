import { api } from './api.js';
import { ensurePushSubscription } from './push.js';
import { pickActiveProfile, tasksForWeekday, zonedNow, classifyTask } from './lib/schedule-logic.mjs';
import { initJobsTab } from './jobs.js';
import { initScheduleEditor } from './schedule-editor.js';

const REFRESH_MS = 30_000;

// ---- tabs ----
document.querySelectorAll('.tab').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
  });
});

// ---- service worker ----
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('service-worker.js').catch((err) => console.error('SW register failed', err));
}

document.getElementById('enable-push').addEventListener('click', async () => {
  const btn = document.getElementById('enable-push');
  btn.disabled = true;
  btn.textContent = 'Requesting...';
  const result = await ensurePushSubscription();
  btn.disabled = false;
  btn.textContent = result.ok ? 'Notifications enabled' : `Couldn't enable (${result.reason})`;
});

function fmtTime(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

function elapsedLabel(task, nowMinutes, status) {
  if (status === 'active') {
    const mins = nowMinutes - task.startMin;
    return `${mins}m in`;
  }
  if (status === 'overdue') {
    const mins = nowMinutes - task.endMin;
    return `${mins}m overdue`;
  }
  return '';
}

let currentDateStr = null;

async function loadToday() {
  const { profiles } = await api.getSchedule();
  const roughDate = new Date().toISOString().slice(0, 10);
  let profile = pickActiveProfile(profiles, roughDate);
  if (!profile) return renderTasks(null, [], new Set(), 0);

  const { dateStr, weekday, minutes } = zonedNow(profile.timezone);
  profile = pickActiveProfile(profiles, dateStr) ?? profile;
  currentDateStr = dateStr;

  const tasks = tasksForWeekday(profile, weekday);
  const doneResp = tasks.length ? await api.getDone(dateStr) : { doneTaskIds: [] };
  const doneSet = new Set(doneResp.doneTaskIds ?? []);

  renderTasks(profile, tasks, doneSet, minutes);
}

function renderTasks(profile, tasks, doneSet, nowMinutes) {
  const list = document.getElementById('task-list');
  const empty = document.getElementById('task-empty');
  list.innerHTML = '';

  if (!tasks.length) {
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  for (const task of tasks) {
    const status = classifyTask(task, nowMinutes, doneSet.has(task.id));
    const li = document.createElement('li');
    li.className = `task ${status}`;
    li.innerHTML = `
      <div class="info">
        <div class="label">${task.label}</div>
        <div class="time">${fmtTime(task.start)} – ${fmtTime(task.end)}</div>
        <div class="elapsed">${elapsedLabel(task, nowMinutes, status)}</div>
      </div>
      <button class="mark-btn" ${status === 'done' ? 'disabled' : ''}>${status === 'done' ? 'Done ✓' : 'Mark done'}</button>
    `;
    li.querySelector('.mark-btn').addEventListener('click', async () => {
      if (!currentDateStr) return;
      await api.markDone(currentDateStr, task.id);
      loadToday();
      loadStreak();
    });
    list.appendChild(li);
  }
}

async function loadStreak() {
  try {
    const { streak } = await api.getStreak();
    document.getElementById('streak-badge').textContent = `${streak} day${streak === 1 ? '' : 's'} streak`;
  } catch {
    document.getElementById('streak-badge').textContent = '— streak';
  }
}

async function refreshAll() {
  await Promise.allSettled([loadToday(), loadStreak()]);
}

refreshAll();
setInterval(refreshAll, REFRESH_MS);

initJobsTab();
initScheduleEditor();
