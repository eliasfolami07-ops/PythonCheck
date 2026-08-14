// ---------- Navigation ----------
const navItems = document.querySelectorAll('.nav-item');
const views = document.querySelectorAll('.view');
const viewTitle = document.getElementById('viewTitle');
const titles = { overview: 'Overview', users: 'Users', settings: 'Settings' };

navItems.forEach(item => {
  item.addEventListener('click', (e) => {
    e.preventDefault();
    const view = item.dataset.view;
    navItems.forEach(i => i.classList.remove('active'));
    item.classList.add('active');
    views.forEach(v => v.classList.remove('active'));
    document.getElementById('view-' + view).classList.add('active');
    viewTitle.textContent = titles[view];
    document.getElementById('sidebar').classList.remove('open');
    if (view === 'users') loadUsers();
  });
});

document.getElementById('menuToggle').addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('open');
});

// ---------- Toast ----------
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2200);
}

// ---------- Stats ----------
async function loadStats() {
  const res = await fetch('/api/stats');
  const d = await res.json();
  document.getElementById('statUsers').textContent = d.total_users;
  document.getElementById('statActive').textContent = d.active_users;
  document.getElementById('statPending').textContent = d.pending_users;
  document.getElementById('statRevenue').textContent = '$' + d.revenue.toLocaleString();
  const g = document.getElementById('statGrowth');
  g.textContent = (d.growth_pct >= 0 ? '▲ ' : '▼ ') + Math.abs(d.growth_pct) + '% vs last period';
  g.className = 'stat-trend ' + (d.growth_pct >= 0 ? 'up' : '');
}

// ---------- Charts ----------
let activityChart, roleChart;

async function loadActivityChart() {
  const res = await fetch('/api/activity');
  const data = await res.json();
  const ctx = document.getElementById('activityChart');
  if (activityChart) activityChart.destroy();
  activityChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.map(d => d.label),
      datasets: [{
        data: data.map(d => d.value),
        borderColor: '#35D0BA',
        backgroundColor: 'rgba(53,208,186,0.12)',
        fill: true,
        tension: 0.35,
        pointRadius: 0,
        borderWidth: 2,
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#8B93A8', maxTicksLimit: 7 }, grid: { display: false } },
        y: { ticks: { color: '#8B93A8' }, grid: { color: 'rgba(255,255,255,0.05)' } }
      }
    }
  });
}

async function loadRoleChart() {
  const res = await fetch('/api/users');
  const users = await res.json();
  const counts = {};
  users.forEach(u => { counts[u.role] = (counts[u.role] || 0) + 1; });
  const ctx = document.getElementById('roleChart');
  if (roleChart) roleChart.destroy();
  roleChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: Object.keys(counts),
      datasets: [{
        data: Object.values(counts),
        backgroundColor: ['#F2A93B', '#35D0BA', '#6C7BFF', '#E8636B'],
        borderColor: '#161D2E',
        borderWidth: 3,
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { position: 'bottom', labels: { color: '#8B93A8', boxWidth: 10, padding: 14 } } }
    }
  });
}

// ---------- Users table ----------
const usersBody = document.getElementById('usersBody');
const searchInput = document.getElementById('searchInput');
const statusFilter = document.getElementById('statusFilter');

async function loadUsers() {
  const q = encodeURIComponent(searchInput.value);
  const status = statusFilter.value;
  const res = await fetch(`/api/users?q=${q}&status=${status}`);
  const users = await res.json();
  usersBody.innerHTML = users.map(u => `
    <tr data-id="${u.id}">
      <td>${escapeHtml(u.name)}</td>
      <td>${escapeHtml(u.email)}</td>
      <td>${escapeHtml(u.role)}</td>
      <td><span class="badge ${u.status}">${u.status}</span></td>
      <td>${u.joined}</td>
      <td><button class="row-del" title="Delete user">✕</button></td>
    </tr>
  `).join('') || `<tr><td colspan="6" class="muted">No users match your filters.</td></tr>`;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

let searchTimer;
searchInput.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(loadUsers, 250);
});
statusFilter.addEventListener('change', loadUsers);

usersBody.addEventListener('click', async (e) => {
  if (e.target.classList.contains('row-del')) {
    const tr = e.target.closest('tr');
    const id = tr.dataset.id;
    await fetch(`/api/users/${id}`, { method: 'DELETE' });
    toast('User removed');
    loadUsers();
    loadStats();
  }
});

// ---------- Add user modal ----------
const backdrop = document.getElementById('modalBackdrop');
document.getElementById('addUserBtn').addEventListener('click', () => backdrop.classList.add('show'));
document.getElementById('cancelAdd').addEventListener('click', () => backdrop.classList.remove('show'));
backdrop.addEventListener('click', (e) => { if (e.target === backdrop) backdrop.classList.remove('show'); });

document.getElementById('confirmAdd').addEventListener('click', async () => {
  const name = document.getElementById('newName').value.trim();
  const email = document.getElementById('newEmail').value.trim();
  const role = document.getElementById('newRole').value;
  if (!name || !email) { toast('Name and email are required'); return; }
  await fetch('/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, role })
  });
  backdrop.classList.remove('show');
  document.getElementById('newName').value = '';
  document.getElementById('newEmail').value = '';
  toast('User added');
  loadUsers();
  loadStats();
  loadRoleChart();
});

// ---------- Init + live polling ----------
function init() {
  loadStats();
  loadActivityChart();
  loadRoleChart();
  loadUsers();
  setInterval(loadStats, 15000); // simulate live data
}
init();
