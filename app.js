const input = document.getElementById('todoInput');
const ddlInput = document.getElementById('ddlInput');
const addBtn = document.getElementById('addBtn');
const list = document.getElementById('todoList');
const footer = document.getElementById('footer');
const hideToggle = document.getElementById('hideDone');
const themeBtn = document.getElementById('themeToggle');
const tabBtns = document.querySelectorAll('.tab-btn');

let data = { work: [], personal: [], trash: [] };
let activeTab = 'work';
let dragIdx = null;
let showTrash = false;

// Storage helpers (localStorage for PWA)
function storeGet(key) { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } }
function storeSet(key, val) { localStorage.setItem(key, JSON.stringify(val)); }

function todos() { return data[activeTab]; }

function save() {
  storeSet('data', data);
  storeSet('activeTab', activeTab);
  clearTimeout(save._timer);
  save._timer = setTimeout(() => syncToGist(), 2000);
}

async function syncToGist() {
  const token = storeGet('gistToken'), id = storeGet('gistId');
  if (!token || !id) return;
  try { await gistSave(token, id, data); } catch {}
}

async function syncFromGist() {
  const token = storeGet('gistToken'), id = storeGet('gistId');
  if (!token || !id) return;
  try {
    const remote = await gistLoad(token, id);
    if (remote) { data = remote; storeSet('data', data); render(); }
  } catch {}
}

function showSyncStatus() {}

function load() {
  data = storeGet('data') || { work: [], personal: [], trash: [] };
  if (!data.trash) data.trash = [];
  activeTab = storeGet('activeTab') || 'work';
  hideToggle.checked = storeGet('hideDone') || false;
  updateTabs(); render();
  syncFromGist();
}

function updateTabs() {
  tabBtns.forEach(btn => btn.classList.toggle('active', btn.dataset.tab === activeTab));
}

function render() {
  list.innerHTML = '';
  const items = todos();
  items.forEach((t, i) => {
    if (hideToggle.checked && t.done) return;
    const li = document.createElement('li');
    li.dataset.idx = i;
    if (t.done) li.classList.add('done');

    if (!t.done) {
      li.draggable = true;
      li.addEventListener('dragstart', onDragStart);
      li.addEventListener('dragover', onDragOver);
      li.addEventListener('drop', onDrop);
      li.addEventListener('dragend', onDragEnd);
      li.addEventListener('touchstart', onTouchStart, { passive: false });
      li.addEventListener('touchmove', onTouchMove, { passive: false });
      li.addEventListener('touchend', onTouchEnd);
    }

    let ddlHtml = '';
    if (t.ddl) {
      const isOverdue = !t.done && new Date(t.ddl) < new Date();
      ddlHtml = `<span class="ddl clickable ${isOverdue ? 'overdue' : ''}">${t.ddl}</span>`;
    } else {
      ddlHtml = `<span class="ddl clickable add-ddl">+ Due date</span>`;
    }

    li.innerHTML = `
      <input type="checkbox" ${t.done ? 'checked' : ''}>
      <div class="task-content">
        <span>${escHtml(t.text)}</span>${ddlHtml}
        <ul class="subtasks">${(t.subtasks || []).map((s, si) => `
          <li class="${s.done ? 'done' : ''}">
            <input type="checkbox" data-task="${i}" data-sub="${si}" ${s.done ? 'checked' : ''}>
            <span>${escHtml(s.text)}</span>
            <button class="del-sub" data-task="${i}" data-sub="${si}">✕</button>
          </li>`).join('')}
        </ul>
      </div>
      <div class="task-actions">
        <button class="del-btn">✕</button>
        <button class="add-sub-btn" data-task="${i}">+</button>
      </div>`;

    li.querySelector('input[type="checkbox"]').addEventListener('change', () => toggle(i));
    li.querySelector('.del-btn').addEventListener('click', () => remove(i));
    li.querySelector('.add-sub-btn').addEventListener('click', () => showSubInput(li, i));
    li.querySelector('.task-content > span').addEventListener('click', (e) => editTask(e.target, i));
    li.querySelector('.ddl.clickable').addEventListener('click', (e) => editDdl(e.target, i));
    li.querySelectorAll('.subtasks input').forEach(cb => {
      cb.addEventListener('change', (e) => toggleSub(+e.target.dataset.task, +e.target.dataset.sub));
    });
    li.querySelectorAll('.del-sub').forEach(btn => {
      btn.addEventListener('click', (e) => removeSub(+e.target.dataset.task, +e.target.dataset.sub));
    });
    li.querySelectorAll('.subtasks span').forEach(span => {
      span.addEventListener('click', (e) => {
        const subLi = e.target.closest('li');
        const ti = +subLi.querySelector('input').dataset.task;
        const si = +subLi.querySelector('input').dataset.sub;
        editSubTask(e.target, ti, si);
      });
    });
    list.appendChild(li);
  });
  const total = items.length;
  const pending = items.filter(t => !t.done).length;
  footer.textContent = total ? `${pending} pending / ${total} total` : '';
  renderTrash();
}

function renderTrash() {
  const trashPanel = document.getElementById('trashPanel');
  const trashBtn = document.getElementById('trashBtn');
  trashBtn.classList.toggle('has-items', data.trash.length > 0);
  trashPanel.style.display = showTrash ? 'block' : 'none';
  if (!showTrash) return;
  trashPanel.innerHTML = data.trash.length ? data.trash.map((t, i) =>
    `<div class="trash-item"><span>${escHtml(t.text)}</span><button data-i="${i}" class="restore-btn">↩</button></div>`
  ).join('') + `<button class="clear-trash-btn" id="clearTrashBtn">Clear trash</button>` : '<div class="trash-empty">Trash is empty</div>';
  trashPanel.querySelectorAll('.restore-btn').forEach(btn => {
    btn.addEventListener('click', () => restore(+btn.dataset.i));
  });
  const clearBtn = trashPanel.querySelector('#clearTrashBtn');
  if (clearBtn) clearBtn.addEventListener('click', clearTrash);
}

function add() {
  const text = input.value.trim();
  if (!text) return;
  const ddl = ddlInput.value || null;
  data[activeTab].unshift({ text, done: false, ddl, subtasks: [] });
  input.value = ''; ddlInput.value = '';
  save(); render();
}

function toggle(i) {
  const items = todos();
  items[i].done = !items[i].done;
  if (items[i].done) {
    const lis = list.querySelectorAll('li');
    const li = Array.from(lis).find(el => +el.dataset.idx === i);
    if (li) { li.classList.add('completing'); setTimeout(() => { save(); render(); }, 400); return; }
  }
  save(); render();
}

function remove(i) { data.trash.unshift(data[activeTab].splice(i, 1)[0]); save(); render(); }
function restore(i) { data[activeTab].unshift(data.trash.splice(i, 1)[0]); save(); render(); }
function clearTrash() { data.trash = []; save(); render(); }
function toggleSub(i, si) { todos()[i].subtasks[si].done = !todos()[i].subtasks[si].done; save(); render(); }
function removeSub(i, si) { todos()[i].subtasks.splice(si, 1); save(); render(); }
function addSub(i, text) { todos()[i].subtasks.push({ text, done: false }); save(); render(); }

function showSubInput(li, i) {
  const existing = li.querySelector('.sub-input');
  if (existing) { existing.focus(); return; }
  const row = document.createElement('div');
  row.className = 'add-sub-row';
  row.innerHTML = '<input type="text" placeholder="Add subtask..." class="sub-input">';
  li.querySelector('.task-content').appendChild(row);
  const inp = row.querySelector('input');
  inp.focus();
  inp.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && inp.value.trim()) { addSub(i, inp.value.trim()); }
    if (e.key === 'Escape') row.remove();
  });
  inp.addEventListener('blur', () => { if (!inp.value.trim()) row.remove(); });
}

function editTask(span, i) {
  const inp = document.createElement('input');
  inp.type = 'text'; inp.value = todos()[i].text; inp.className = 'edit-input';
  span.replaceWith(inp); inp.focus(); inp.select();
  const commit = () => { const v = inp.value.trim(); if (v) todos()[i].text = v; save(); render(); };
  inp.addEventListener('blur', commit);
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') inp.blur(); if (e.key === 'Escape') { inp.value = todos()[i].text; inp.blur(); } });
}

function editSubTask(span, i, si) {
  const inp = document.createElement('input');
  inp.type = 'text'; inp.value = todos()[i].subtasks[si].text; inp.className = 'sub-input';
  span.replaceWith(inp); inp.focus(); inp.select();
  const commit = () => { const v = inp.value.trim(); if (v) todos()[i].subtasks[si].text = v; save(); render(); };
  inp.addEventListener('blur', commit);
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') inp.blur(); if (e.key === 'Escape') { inp.value = todos()[i].subtasks[si].text; inp.blur(); } });
}

function editDdl(span, i) {
  const inp = document.createElement('input');
  inp.type = 'date'; inp.value = todos()[i].ddl || new Date().toISOString().slice(0, 10); inp.className = 'edit-input';
  span.replaceWith(inp); inp.focus();
  const commit = () => { todos()[i].ddl = inp.value || null; save(); render(); };
  inp.addEventListener('blur', commit);
  inp.addEventListener('change', commit);
  inp.addEventListener('keydown', e => { if (e.key === 'Escape') inp.blur(); });
}

// Drag & drop (desktop)
function onDragStart(e) { dragIdx = +e.currentTarget.dataset.idx; e.currentTarget.classList.add('dragging'); }
function onDragOver(e) {
  e.preventDefault();
  const li = e.currentTarget;
  const rect = li.getBoundingClientRect();
  const mid = rect.top + rect.height / 2;
  list.querySelectorAll('li').forEach(el => el.classList.remove('drag-over-top', 'drag-over-bottom'));
  li.classList.add(e.clientY < mid ? 'drag-over-top' : 'drag-over-bottom');
}
function onDrop(e) {
  e.preventDefault();
  list.querySelectorAll('li').forEach(el => el.classList.remove('drag-over-top', 'drag-over-bottom'));
  const li = e.currentTarget;
  const rect = li.getBoundingClientRect();
  const mid = rect.top + rect.height / 2;
  let dropIdx = +li.dataset.idx;
  if (e.clientY > mid && dropIdx < dragIdx) dropIdx++;
  else if (e.clientY < mid && dropIdx > dragIdx) dropIdx--;
  if (dragIdx === null || dragIdx === dropIdx) return;
  const items = todos();
  const [item] = items.splice(dragIdx, 1);
  items.splice(dropIdx, 0, item);
  save(); render();
}
function onDragEnd(e) {
  dragIdx = null; e.currentTarget.classList.remove('dragging');
  list.querySelectorAll('li').forEach(el => el.classList.remove('drag-over-top', 'drag-over-bottom'));
}

// Touch drag (mobile)
let touchLi = null, touchStartY = 0, touchClone = null;
function onTouchStart(e) {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') return;
  touchLi = e.currentTarget;
  touchStartY = e.touches[0].clientY;
  dragIdx = +touchLi.dataset.idx;
}
function onTouchMove(e) {
  if (!touchLi) return;
  e.preventDefault();
  const y = e.touches[0].clientY;
  touchLi.style.transform = `translateY(${y - touchStartY}px)`;
  touchLi.style.opacity = '0.7';
  touchLi.style.zIndex = '999';
  // highlight drop target
  list.querySelectorAll('li').forEach(el => {
    el.classList.remove('drag-over-top', 'drag-over-bottom');
    if (el === touchLi) return;
    const rect = el.getBoundingClientRect();
    if (y > rect.top && y < rect.bottom) {
      el.classList.add(y < rect.top + rect.height / 2 ? 'drag-over-top' : 'drag-over-bottom');
    }
  });
}
function onTouchEnd(e) {
  if (!touchLi) return;
  const y = e.changedTouches[0].clientY;
  let dropIdx = dragIdx;
  list.querySelectorAll('li').forEach(el => {
    if (el === touchLi) return;
    const rect = el.getBoundingClientRect();
    if (y > rect.top && y < rect.bottom) dropIdx = +el.dataset.idx;
  });
  list.querySelectorAll('li').forEach(el => el.classList.remove('drag-over-top', 'drag-over-bottom'));
  if (dragIdx !== null && dragIdx !== dropIdx) {
    const items = todos();
    const [item] = items.splice(dragIdx, 1);
    items.splice(dropIdx, 0, item);
    save();
  }
  touchLi.style.transform = ''; touchLi.style.opacity = ''; touchLi.style.zIndex = '';
  touchLi = null; dragIdx = null;
  render();
}

function escHtml(s) { return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]); }

// Theme
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  themeBtn.textContent = theme === 'light' ? '🌙' : '☀️';
}
themeBtn.addEventListener('click', () => {
  const next = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
  applyTheme(next);
  storeSet('theme', next);
});

// Tabs
tabBtns.forEach(btn => btn.addEventListener('click', () => {
  activeTab = btn.dataset.tab;
  updateTabs(); save(); render();
}));

addBtn.addEventListener('click', add);
input.addEventListener('keydown', e => { if (e.key === 'Enter') add(); });
hideToggle.addEventListener('change', () => { storeSet('hideDone', hideToggle.checked); render(); });
document.getElementById('trashBtn').addEventListener('click', () => { showTrash = !showTrash; renderTrash(); });

// Settings
const settingsBtn = document.getElementById('settingsBtn');
const settingsPanel = document.getElementById('settingsPanel');
settingsBtn.addEventListener('click', () => {
  settingsPanel.style.display = settingsPanel.style.display === 'none' ? 'block' : 'none';
  if (settingsPanel.style.display === 'block') {
    document.getElementById('gistToken').value = storeGet('gistToken') || '';
    document.getElementById('gistId').value = storeGet('gistId') || '';
  }
});
document.getElementById('saveSettings').addEventListener('click', () => {
  storeSet('gistToken', document.getElementById('gistToken').value.trim());
  storeSet('gistId', document.getElementById('gistId').value.trim());
  settingsPanel.style.display = 'none';
  syncFromGist();
});

applyTheme(storeGet('theme') || 'dark');
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js');
load();
setInterval(syncFromGist, 60000);
