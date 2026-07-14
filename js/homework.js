import { api } from './api.js';

function localDateStr(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function daysUntil(dueDate) {
  const today = new Date(`${localDateStr()}T00:00:00`);
  const due = new Date(`${dueDate}T00:00:00`);
  return Math.round((due - today) / 86400000);
}

function statusFor(days) {
  if (days > 0) return { cls: 'upcoming', label: `Due in ${days}d` };
  if (days === 0) return { cls: 'active', label: 'Due today' };
  return { cls: 'overdue', label: `Overdue by ${-days}d` };
}

async function loadHomework() {
  const { items, doneIds } = await api.getHomework();
  render(items, new Set(doneIds));
}

function render(items, doneSet) {
  const list = document.getElementById('homework-list');
  const empty = document.getElementById('homework-empty');
  list.innerHTML = '';

  if (!items.length) {
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  const sorted = [...items].sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1));

  for (const item of sorted) {
    const isDone = doneSet.has(item.id);
    const { cls, label } = isDone ? { cls: 'done', label: 'Done' } : statusFor(daysUntil(item.dueDate));

    const li = document.createElement('li');
    li.className = `task ${cls}`;
    li.innerHTML = `
      <div class="info">
        <div class="label">${item.label}</div>
        <div class="time">Due ${item.dueDate}</div>
        <div class="elapsed">${label}</div>
      </div>
      <button class="mark-btn" ${isDone ? 'disabled' : ''}>${isDone ? 'Done ✓' : 'Mark done'}</button>
    `;
    li.querySelector('.mark-btn').addEventListener('click', async () => {
      await api.markHomeworkDone(item.id);
      loadHomework();
    });
    list.appendChild(li);
  }
}

export function initHomework() {
  document.getElementById('homework-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const labelInput = document.getElementById('homework-label');
    const dueInput = document.getElementById('homework-due');
    if (!labelInput.value || !dueInput.value) return;
    await api.addHomework(labelInput.value, dueInput.value);
    labelInput.value = '';
    dueInput.value = '';
    loadHomework();
  });

  loadHomework();
  setInterval(loadHomework, 30_000);
}
