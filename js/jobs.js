import { api } from './api.js';

const STATUSES = ['not_applied', 'applied', 'oa', 'interview', 'offer', 'rejected'];
const FRESH_DAYS = 3;

let listings = [];
let applications = {};
let sortKey = 'ageDays';
let sortDir = 1;
let categoryFilter = 'all';

function ageInDays(ageStr) {
  const m = /(\d+)\s*d/i.exec(ageStr || '');
  if (m) return Number(m[1]);
  if (/today|new/i.test(ageStr || '')) return 0;
  return 999;
}

async function loadJobs() {
  const [listingsResp, appsResp] = await Promise.all([
    fetch('data/listings.json').then((r) => r.json()),
    api.getApplications().catch(() => ({ applications: {} })),
  ]);
  listings = listingsResp.listings ?? [];
  applications = appsResp.applications ?? {};

  const updatedEl = document.getElementById('jobs-updated');
  updatedEl.textContent = listingsResp.updatedAt
    ? `Updated ${new Date(listingsResp.updatedAt).toLocaleString()}`
    : '';

  renderJobs();
}

function renderJobs() {
  const onlyNotApplied = document.getElementById('filter-not-applied').checked;
  const body = document.getElementById('jobs-body');
  body.innerHTML = '';

  let rows = listings.map((job) => ({
    ...job,
    status: applications[job.url]?.status ?? 'not_applied',
    ageDays: ageInDays(job.age),
  }));

  if (onlyNotApplied) rows = rows.filter((r) => r.status === 'not_applied');
  if (categoryFilter !== 'all') rows = rows.filter((r) => r.category === categoryFilter);

  rows.sort((a, b) => {
    const av = a[sortKey];
    const bv = b[sortKey];
    if (av === bv) return 0;
    return (av > bv ? 1 : -1) * sortDir;
  });

  for (const job of rows) {
    const tr = document.createElement('tr');
    if (job.ageDays <= FRESH_DAYS) tr.classList.add('fresh');
    tr.innerHTML = `
      <td>${job.company}</td>
      <td class="pos">${job.position}</td>
      <td class="loc">${job.location}</td>
      <td>${job.category}</td>
      <td>${job.salary || '—'}</td>
      <td>${job.age || '—'}</td>
      <td></td>
    `;
    tr.querySelector('td:nth-child(2)').innerHTML = `<a href="${job.url}" target="_blank" rel="noopener">${job.position}</a>`;

    const statusCell = tr.querySelector('td:last-child');
    const select = document.createElement('select');
    select.className = 'status';
    for (const s of STATUSES) {
      const opt = document.createElement('option');
      opt.value = s;
      opt.textContent = s.replace('_', ' ');
      if (s === job.status) opt.selected = true;
      select.appendChild(opt);
    }
    select.addEventListener('change', async () => {
      await api.setApplicationStatus(job.url, select.value);
      applications[job.url] = { ...(applications[job.url] ?? {}), status: select.value };
      if (onlyNotApplied) renderJobs();
    });
    statusCell.appendChild(select);
    body.appendChild(tr);
  }
}

export function initJobsTab() {
  document.getElementById('filter-not-applied').addEventListener('change', renderJobs);
  document.getElementById('filter-category').addEventListener('change', (e) => {
    categoryFilter = e.target.value;
    renderJobs();
  });
  document.querySelectorAll('#jobs-table th[data-sort]').forEach((th) => {
    th.addEventListener('click', () => {
      const key = th.dataset.sort === 'age' ? 'ageDays' : th.dataset.sort;
      sortDir = sortKey === key ? -sortDir : 1;
      sortKey = key;
      renderJobs();
    });
  });
  loadJobs();
}
