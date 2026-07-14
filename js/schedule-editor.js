import { api } from './api.js';
import { pickActiveProfile } from './lib/schedule-logic.mjs';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

let profiles = [];
let editing = null; // deep-cloned profile being edited

function blankTask() {
  return { id: `task-${Math.random().toString(36).slice(2, 8)}`, label: '', start: '09:00', end: '10:00' };
}

function render() {
  const root = document.getElementById('schedule-editor');
  root.innerHTML = '';

  const meta = document.createElement('div');
  meta.className = 'day-block';
  meta.innerHTML = `
    <h3>Profile</h3>
    <div class="day-task-row" style="grid-template-columns: 1fr 8rem;">
      <input id="profile-name" placeholder="profile name (e.g. fall)" value="${editing.name}" />
      <input id="profile-active-from" type="date" value="${editing.activeFrom}" />
    </div>
    <p class="hint">Same name = edits that profile. New name = adds a new one (e.g. a future "fall" schedule).</p>
  `;
  root.appendChild(meta);

  DAY_NAMES.forEach((dayName, dayIndex) => {
    const block = document.createElement('div');
    block.className = 'day-block';
    const tasks = editing.days[String(dayIndex)] ?? [];
    block.innerHTML = `<h3>${dayName}</h3><div class="rows" data-day="${dayIndex}"></div>
      <button class="add-task-btn" data-day="${dayIndex}">+ add task</button>`;
    const rowsEl = block.querySelector('.rows');
    tasks.forEach((task, taskIndex) => rowsEl.appendChild(renderTaskRow(dayIndex, taskIndex, task)));
    block.querySelector('.add-task-btn').addEventListener('click', () => {
      editing.days[String(dayIndex)] = [...(editing.days[String(dayIndex)] ?? []), blankTask()];
      render();
    });
    root.appendChild(block);
  });
}

function renderTaskRow(dayIndex, taskIndex, task) {
  const row = document.createElement('div');
  row.className = 'day-task-row';
  row.innerHTML = `
    <input class="t-label" value="${task.label}" placeholder="label" />
    <input class="t-start" type="time" value="${task.start}" />
    <input class="t-end" type="time" value="${task.end}" />
    <button class="t-remove" title="remove">✕</button>
  `;
  const dayKey = String(dayIndex);
  row.querySelector('.t-label').addEventListener('input', (e) => {
    editing.days[dayKey][taskIndex].label = e.target.value;
  });
  row.querySelector('.t-start').addEventListener('input', (e) => {
    editing.days[dayKey][taskIndex].start = e.target.value;
  });
  row.querySelector('.t-end').addEventListener('input', (e) => {
    editing.days[dayKey][taskIndex].end = e.target.value;
  });
  row.querySelector('.t-remove').addEventListener('click', () => {
    editing.days[dayKey].splice(taskIndex, 1);
    render();
  });
  return row;
}

function slugTaskIds(profile) {
  for (const day of Object.keys(profile.days)) {
    profile.days[day] = profile.days[day].map((t) => ({
      ...t,
      id: t.id || `d${day}-${t.label.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 24)}`,
    }));
  }
  return profile;
}

async function save() {
  const status = document.getElementById('schedule-save-status');
  status.textContent = 'Saving...';
  editing.name = document.getElementById('profile-name').value.trim() || editing.name;
  editing.activeFrom = document.getElementById('profile-active-from').value || editing.activeFrom;
  slugTaskIds(editing);

  const next = profiles.filter((p) => p.name !== editing.name);
  next.push(editing);

  try {
    await api.saveSchedule(next);
    profiles = next;
    status.textContent = 'Saved.';
  } catch (err) {
    status.textContent = `Save failed: ${err.message}`;
  }
}

export async function initScheduleEditor() {
  const { profiles: loaded } = await api.getSchedule();
  profiles = loaded;
  const todayStr = new Date().toISOString().slice(0, 10);
  const active = pickActiveProfile(profiles, todayStr) ?? profiles[0];
  editing = structuredClone(active);
  render();

  document.getElementById('schedule-save').addEventListener('click', save);
}
