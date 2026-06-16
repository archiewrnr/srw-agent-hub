/* =============================================
   COMMAND CENTER — APP.JS
   ============================================= */

// =============================================
// STATE & STORAGE
// =============================================

const KEYS = {
  tasks: 'pct_tasks_daily',
  habits: 'pct_goals_daily',
  monthly: 'pct_goals_monthly',
  workouts: 'pct_workouts',
  exercises: 'pct_exercises',
  nutrition: 'pct_nutrition_log',
  presets: 'pct_meal_presets',
  mealPlan: 'pct_meal_plan',
  sleep: 'pct_sleep_log',
  steps: 'pct_steps_log',
  whoop: 'pct_whoop_log',
  fbaBuyList: 'pct_fba_buy_list',
  fbaContacts: 'pct_fba_contacts',
  fbaStorefronts: 'pct_fba_storefronts',
  settings: 'pct_settings',
  streaks: 'pct_streaks',
  weight: 'pct_weight_log',
  mindset: 'pct_mindset_log',
  lastOpen: 'pct_last_open',
  weeklyReview: 'pct_weekly_review',
  water: 'pct_water_log',
  workoutActive: 'pct_workout_active',
};

const load = k => { try { return JSON.parse(localStorage.getItem(k)) || null; } catch { return null; } };
const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function todayLabel() {
  return new Date().toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long', year:'numeric' }).toUpperCase();
}
function monthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}

// =============================================
// DEFAULT SETTINGS
// =============================================
const DEFAULT_SETTINGS = {
  calories: 2000, protein: 200, carbs: 100, fat: 75,
  phase: 'CUTTING', steps: 10000, sleep: 8, wake: '07:00',
  accent: '#00d4ff', compact: false,
  split: ['PUSH','PULL','LEGS','REST','PUSH','PULL','REST'],
};

function getSettings() {
  return Object.assign({}, DEFAULT_SETTINGS, load(KEYS.settings) || {});
}

// =============================================
// DEFAULT EXERCISES
// =============================================
const DEFAULT_EXERCISES = [
  { id: 'bp',  name: 'Bench Press',          muscle: 'Chest',     sets: 4, reps: 8  },
  { id: 'ibp', name: 'Incline DB Press',      muscle: 'Chest',     sets: 3, reps: 10 },
  { id: 'ohp', name: 'Overhead Press',        muscle: 'Shoulders', sets: 4, reps: 8  },
  { id: 'lr',  name: 'Lateral Raises',        muscle: 'Shoulders', sets: 3, reps: 15 },
  { id: 'tpd', name: 'Tricep Pushdowns',      muscle: 'Triceps',   sets: 3, reps: 12 },
  { id: 'sc',  name: 'Skull Crushers',        muscle: 'Triceps',   sets: 3, reps: 10 },
  { id: 'dl',  name: 'Deadlifts',             muscle: 'Back',      sets: 4, reps: 5  },
  { id: 'br',  name: 'Barbell Rows',          muscle: 'Back',      sets: 4, reps: 8  },
  { id: 'pu',  name: 'Pull-ups',              muscle: 'Back',      sets: 3, reps: 8  },
  { id: 'fp',  name: 'Face Pulls',            muscle: 'Shoulders', sets: 3, reps: 15 },
  { id: 'bc',  name: 'Barbell Curls',         muscle: 'Biceps',    sets: 3, reps: 10 },
  { id: 'hc',  name: 'Hammer Curls',          muscle: 'Biceps',    sets: 3, reps: 12 },
  { id: 'sq',  name: 'Squats',                muscle: 'Legs',      sets: 4, reps: 8  },
  { id: 'rdl', name: 'Romanian Deadlifts',    muscle: 'Legs',      sets: 3, reps: 10 },
  { id: 'lp',  name: 'Leg Press',             muscle: 'Legs',      sets: 3, reps: 12 },
  { id: 'lc',  name: 'Leg Curl',              muscle: 'Legs',      sets: 3, reps: 12 },
  { id: 'cr',  name: 'Calf Raises',           muscle: 'Legs',      sets: 4, reps: 20 },
  { id: 'bss', name: 'Bulgarian Split Squats',muscle: 'Legs',      sets: 3, reps: 10 },
];

const PUSH_IDS  = ['bp','ibp','ohp','lr','tpd','sc'];
const PULL_IDS  = ['dl','br','pu','fp','bc','hc'];
const LEGS_IDS  = ['sq','rdl','lp','lc','cr','bss'];

function getExercises() {
  return load(KEYS.exercises) || DEFAULT_EXERCISES;
}

// =============================================
// CLOCK
// =============================================
function startClock() {
  const el = document.getElementById('live-clock');
  function tick() {
    const n = new Date();
    el.textContent = n.toTimeString().slice(0,8);
  }
  tick();
  setInterval(tick, 1000);
}

// =============================================
// MIDNIGHT RESET
// =============================================
function checkMidnightReset() {
  const last = load(KEYS.lastOpen);
  const td = today();
  if (last && last !== td) {
    archiveYesterdayTasks(last);
    resetHabits(last);
    checkStreakBreak(last);
  }
  save(KEYS.lastOpen, td);
}

function archiveYesterdayTasks(date) {
  const all = load(KEYS.tasks) || {};
  if (all[date]) {
    const prev = all[date];
    const arc = load('pct_archive') || {};
    arc[date] = prev;
    save('pct_archive', arc);
  }
}

function resetHabits(date) {
  const habits = load(KEYS.habits) || [];
  habits.forEach(h => {
    if (h.doneToday) {
      h.streak = (h.streak || 0) + 1;
      h.lastDone = date;
    } else {
      h.streak = 0;
    }
    h.doneToday = false;
  });
  save(KEYS.habits, habits);
}

function checkStreakBreak(date) {
  const s = load(KEYS.streaks) || { count: 0, lastDate: null };
  if (s.lastDate && s.lastDate !== date) {
    const diff = (new Date(today()) - new Date(s.lastDate)) / 86400000;
    if (diff > 1) { s.count = 0; save(KEYS.streaks, s); }
  }
}

// =============================================
// TABS
// =============================================
function initTabs() {
  document.querySelectorAll('.nav-tab').forEach((btn, i) => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
}

function switchTab(name) {
  document.querySelectorAll('.nav-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === `tab-${name}`));
  if (name === 'analytics') renderAnalytics();
  if (name === 'business') { renderFbaContacts(); renderPipeline(); renderFbaKpis(); }
}

function initSubnavs() {
  document.querySelectorAll('.subnav-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      const section = btn.closest('.tab-panel');
      section.querySelectorAll('.subnav-tab').forEach(b => b.classList.remove('active'));
      section.querySelectorAll('.subtab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      section.querySelector('#subtab-' + btn.dataset.subtab).classList.add('active');
      if (btn.dataset.subtab === 'amazon') { renderFbaContacts(); renderPipeline(); renderFbaKpis(); }
    });
  });
}

// =============================================
// STATS BAR
// =============================================
function updateStatsBar() {
  const s = getSettings();
  const tasks = getTodayTasks();
  const done = tasks.filter(t => t.done).length;
  document.getElementById('sb-tasks').textContent = `${done}/${tasks.length}`;

  const meals = getTodayMeals();
  const cal = meals.reduce((a,m) => a + (m.calories||0), 0);
  document.getElementById('sb-calories').textContent = `${cal}/${s.calories}`;

  const steps = getTodaySteps();
  document.getElementById('sb-steps').textContent = `${steps.toLocaleString()}/${s.steps.toLocaleString()}`;

  const sleepData = getSleepToday();
  document.getElementById('sb-sleep').textContent = sleepData ? `${sleepData.hours.toFixed(1)}h` : '--h';

  const streak = load(KEYS.streaks) || { count: 0 };
  document.getElementById('sb-streak').textContent = `${streak.count}d`;

}

function getTodayTasks() {
  const all = load(KEYS.tasks) || {};
  return all[today()] || [];
}
function saveTodayTasks(tasks) {
  const all = load(KEYS.tasks) || {};
  all[today()] = tasks;
  save(KEYS.tasks, all);
}
function getTodayMeals() {
  const all = load(KEYS.nutrition) || {};
  return all[today()] || [];
}
function saveTodayMeals(meals) {
  const all = load(KEYS.nutrition) || {};
  all[today()] = meals;
  save(KEYS.nutrition, all);
}
function getTodaySteps() {
  const all = load(KEYS.steps) || {};
  return all[today()] || 0;
}
function getSleepToday() {
  const all = load(KEYS.sleep) || {};
  return all[today()] || null;
}

// =============================================
// TASK BOARD
// =============================================
function renderTasks() {
  const tasks = getTodayTasks();
  const list = document.getElementById('task-list');
  const done = tasks.filter(t => t.done).length;
  const fill = document.getElementById('task-progress-fill');
  const label = document.getElementById('task-progress-label');
  fill.style.width = tasks.length ? `${(done/tasks.length)*100}%` : '0%';
  label.textContent = `${done} / ${tasks.length} complete`;
  document.getElementById('today-date').textContent = todayLabel();

  list.innerHTML = '';
  tasks.forEach((task, i) => {
    const div = document.createElement('div');
    div.className = 'task-item' + (task.done ? '' : ' active-pulse');
    div.draggable = true;
    div.dataset.index = i;
    div.innerHTML = `
      <div class="task-check ${task.done ? 'checked' : ''}" data-i="${i}"></div>
      <div class="task-body">
        <div class="task-name ${task.done ? 'done' : ''}">${escHtml(task.name)}</div>
        <div class="task-meta">
          <span class="priority-badge priority-${task.priority}">${task.priority}</span>
          <span class="category-tag">${task.category}</span>
          ${task.time ? `<span class="time-tag">${task.time}m</span>` : ''}
        </div>
      </div>
      <div class="task-actions">
        <button class="task-edit" data-i="${i}" title="Edit">&#9998;</button>
        <button class="task-delete" data-i="${i}" title="Delete">&#215;</button>
      </div>
      <div class="task-edit-form hidden">
        <input type="text" class="edit-name" value="${escHtml(task.name)}" />
        <div style="display:flex;gap:4px;flex-wrap:wrap">
          <select class="edit-priority">
            <option value="CRITICAL" ${task.priority==='CRITICAL'?'selected':''}>CRITICAL</option>
            <option value="HIGH" ${task.priority==='HIGH'?'selected':''}>HIGH</option>
            <option value="NORMAL" ${task.priority==='NORMAL'?'selected':''}>NORMAL</option>
          </select>
          <select class="edit-category">
            <option value="Business" ${task.category==='Business'?'selected':''}>Business</option>
            <option value="Admin" ${task.category==='Admin'?'selected':''}>Admin</option>
            <option value="Creative" ${task.category==='Creative'?'selected':''}>Creative</option>
            <option value="Finance" ${task.category==='Finance'?'selected':''}>Finance</option>
            <option value="Personal" ${task.category==='Personal'?'selected':''}>Personal</option>
          </select>
          <input type="number" class="edit-time" value="${task.time||''}" placeholder="Min" style="width:52px" />
        </div>
        <div class="form-btns">
          <button class="btn-primary edit-save">SAVE</button>
          <button class="btn-ghost edit-cancel">CANCEL</button>
        </div>
      </div>`;
    list.appendChild(div);

    div.querySelector('.task-check').addEventListener('click', () => toggleTask(i));
    div.querySelector('.task-delete').addEventListener('click', () => deleteTask(i));
    div.querySelector('.task-edit').addEventListener('click', () => {
      const form = div.querySelector('.task-edit-form');
      const isOpen = !form.classList.contains('hidden');
      // Close any other open edit forms first
      document.querySelectorAll('.task-edit-form').forEach(f => f.classList.add('hidden'));
      document.querySelectorAll('.task-item').forEach(el => el.classList.remove('editing'));
      if (!isOpen) {
        form.classList.remove('hidden');
        div.classList.add('editing');
        div.draggable = false;
        div.querySelector('.edit-name').focus();
      }
    });
    div.querySelector('.edit-save').addEventListener('click', () => {
      const tasks2 = getTodayTasks();
      tasks2[i].name = div.querySelector('.edit-name').value.trim() || tasks2[i].name;
      tasks2[i].priority = div.querySelector('.edit-priority').value;
      tasks2[i].category = div.querySelector('.edit-category').value;
      tasks2[i].time = parseInt(div.querySelector('.edit-time').value) || 0;
      saveTodayTasks(tasks2);
      renderTasks();
    });
    div.querySelector('.edit-cancel').addEventListener('click', () => {
      div.querySelector('.task-edit-form').classList.add('hidden');
      div.classList.remove('editing');
      div.draggable = true;
    });
    div.querySelector('.edit-name').addEventListener('keydown', e => {
      if (e.key === 'Enter') div.querySelector('.edit-save').click();
      if (e.key === 'Escape') div.querySelector('.edit-cancel').click();
    });
    setupDrag(div, i);
  });

  renderYesterday();
  updateStatsBar();
  updateStreakPanel();
}

function toggleTask(i) {
  const tasks = getTodayTasks();
  tasks[i].done = !tasks[i].done;
  saveTodayTasks(tasks);
  renderTasks();
  checkStreakUpdate();
}

function deleteTask(i) {
  const tasks = getTodayTasks();
  tasks.splice(i, 1);
  saveTodayTasks(tasks);
  renderTasks();
}

function addTask() {
  const name = document.getElementById('new-task-name').value.trim();
  if (!name) return;
  const tasks = getTodayTasks();
  tasks.push({
    id: Date.now(), name,
    priority: document.getElementById('new-task-priority').value,
    category: document.getElementById('new-task-category').value,
    time: parseInt(document.getElementById('new-task-time').value) || 0,
    done: false,
    created: today(),
  });
  saveTodayTasks(tasks);
  document.getElementById('new-task-name').value = '';
  document.getElementById('new-task-time').value = '';
  document.getElementById('add-task-form').classList.add('hidden');
  document.getElementById('add-task-btn').classList.remove('hidden');
  renderTasks();
}

function renderYesterday() {
  const arc = load('pct_archive') || {};
  const dates = Object.keys(arc).sort().reverse();
  const container = document.getElementById('yesterday-tasks');
  container.innerHTML = '';
  if (!dates.length) return;
  const last = arc[dates[0]];
  if (!last) return;
  last.forEach(t => {
    const d = document.createElement('div');
    d.className = 'task-item';
    d.style.opacity = '0.5';
    d.innerHTML = `<div class="task-check ${t.done?'checked':''}"></div>
      <div class="task-body"><div class="task-name ${t.done?'done':''}">${escHtml(t.name)}</div>
      <div class="task-meta"><span class="priority-badge priority-${t.priority}">${t.priority}</span>
      <span class="category-tag">${t.category}</span></div></div>`;
    container.appendChild(d);
  });
}

// Drag and drop
let dragIdx = null;
function setupDrag(el, i) {
  el.addEventListener('dragstart', () => { dragIdx = i; el.classList.add('dragging'); });
  el.addEventListener('dragend', () => { el.classList.remove('dragging'); });
  el.addEventListener('dragover', e => { e.preventDefault(); });
  el.addEventListener('drop', () => {
    if (dragIdx === null || dragIdx === i) return;
    const tasks = getTodayTasks();
    const moved = tasks.splice(dragIdx, 1)[0];
    tasks.splice(i, 0, moved);
    saveTodayTasks(tasks);
    renderTasks();
    dragIdx = null;
  });
}

// =============================================
// HABITS
// =============================================
function renderHabits() {
  const habits = load(KEYS.habits) || [];
  const list = document.getElementById('habit-list');
  list.innerHTML = '';
  habits.forEach((h, i) => {
    const div = document.createElement('div');
    div.className = 'habit-item';
    div.innerHTML = `
      <div class="habit-check ${h.doneToday ? 'done' : ''}" data-i="${i}"></div>
      <span class="habit-name ${h.doneToday ? 'done' : ''}">${escHtml(h.name)}</span>
      <span class="habit-streak">${h.streak || 0}d</span>
      <div class="task-actions">
        <button class="habit-edit" title="Edit">&#9998;</button>
        <button class="habit-delete" data-i="${i}" title="Delete">&#215;</button>
      </div>
      <div class="task-edit-form hidden" style="width:100%">
        <input type="text" class="edit-habit-name" value="${escHtml(h.name)}" />
        <div class="form-btns">
          <button class="btn-primary habit-edit-save">SAVE</button>
          <button class="btn-ghost habit-edit-cancel">CANCEL</button>
        </div>
      </div>`;
    div.querySelector('.habit-check').addEventListener('click', () => toggleHabit(i));
    div.querySelector('.habit-delete').addEventListener('click', () => deleteHabit(i));
    div.querySelector('.habit-edit').addEventListener('click', () => {
      const form = div.querySelector('.task-edit-form');
      const isOpen = !form.classList.contains('hidden');
      document.querySelectorAll('.task-edit-form').forEach(f => f.classList.add('hidden'));
      if (!isOpen) { form.classList.remove('hidden'); div.querySelector('.edit-habit-name').focus(); }
    });
    div.querySelector('.habit-edit-save').addEventListener('click', () => {
      const habits2 = load(KEYS.habits) || [];
      const newName = div.querySelector('.edit-habit-name').value.trim();
      if (newName) habits2[i].name = newName;
      save(KEYS.habits, habits2);
      renderHabits();
    });
    div.querySelector('.habit-edit-cancel').addEventListener('click', () => {
      div.querySelector('.task-edit-form').classList.add('hidden');
    });
    div.querySelector('.edit-habit-name').addEventListener('keydown', e => {
      if (e.key === 'Enter') div.querySelector('.habit-edit-save').click();
      if (e.key === 'Escape') div.querySelector('.habit-edit-cancel').click();
    });
    list.appendChild(div);
  });
}

function toggleHabit(i) {
  const habits = load(KEYS.habits) || [];
  habits[i].doneToday = !habits[i].doneToday;
  save(KEYS.habits, habits);
  renderHabits();
  checkHabitLevelUp(i);
  checkStreakUpdate();
}

function deleteHabit(i) {
  const habits = load(KEYS.habits) || [];
  habits.splice(i, 1);
  save(KEYS.habits, habits);
  renderHabits();
}

function addHabit() {
  const name = document.getElementById('new-habit-name').value.trim();
  if (!name) return;
  const habits = load(KEYS.habits) || [];
  habits.push({ id: Date.now(), name, streak: 0, doneToday: false, levelHistory: [] });
  save(KEYS.habits, habits);
  document.getElementById('new-habit-name').value = '';
  document.getElementById('add-habit-form').classList.add('hidden');
  renderHabits();
}

function checkHabitLevelUp(i) {
  const habits = load(KEYS.habits) || [];
  const h = habits[i];
  if (h.doneToday && (h.streak + 1) === 7) {
    showLevelUpModal(i, h);
  }
}

let pendingLevelUpIdx = null;
function showLevelUpModal(i, h) {
  pendingLevelUpIdx = i;
  document.getElementById('levelup-content').innerHTML = `
    <p style="color:var(--text-muted);font-size:13px">You've hit <strong style="color:var(--accent)">"${escHtml(h.name)}"</strong> 7 days in a row.</p>
    <p style="margin-top:8px;color:var(--text-muted);font-size:13px">Ready to level it up? Update the habit name to reflect your upgraded goal:</p>
    <input type="text" id="levelup-new-name" value="${escHtml(h.name)} (upgraded)" style="margin-top:10px;background:var(--bg);border:1px solid var(--border2);color:var(--text);padding:6px 8px;border-radius:4px;width:100%;outline:none;font-size:13px;" />`;
  document.getElementById('levelup-modal').classList.remove('hidden');
}

// =============================================
// MONTHLY GOALS
// =============================================
function renderMonthlyGoals() {
  const mn = monthKey();
  const all = load(KEYS.monthly) || {};
  const goals = all[mn] || [];
  document.getElementById('month-name').textContent = new Date().toLocaleDateString('en-GB',{month:'long',year:'numeric'}).toUpperCase();
  const list = document.getElementById('monthly-goal-list');
  list.innerHTML = '';
  goals.forEach((g, i) => {
    const pct = g.progress || 0;
    const statusClass = `status-${(g.status||'ON TRACK').replace(' ','.')}`;
    const div = document.createElement('div');
    div.className = 'monthly-goal-item';
    div.innerHTML = `
      <div class="monthly-goal-header">
        <span class="monthly-goal-title">${escHtml(g.title)}</span>
        <div style="display:flex;gap:4px;align-items:center">
          <span class="status-badge ${statusClass}" style="cursor:pointer" data-i="${i}">${g.status||'ON TRACK'}</span>
          <button class="monthly-edit-btn" data-i="${i}" title="Edit" style="background:none;border:none;color:var(--text-dim);cursor:pointer;font-size:13px">&#9998;</button>
          <button class="monthly-del-btn" data-i="${i}" title="Delete" style="background:none;border:none;color:var(--text-dim);cursor:pointer;font-size:14px">&#215;</button>
        </div>
      </div>
      ${g.desc ? `<div class="monthly-goal-desc">${escHtml(g.desc)}</div>` : ''}
      <div class="goal-slider-wrap">
        <input type="range" class="goal-slider" min="0" max="100" value="${pct}" data-i="${i}" />
        <span class="goal-pct" id="gpct-${i}">${pct}%</span>
      </div>
      ${g.due ? `<div class="monthly-goal-due">Due: ${g.due}</div>` : ''}
      <div class="task-edit-form hidden" style="margin-top:6px">
        <input type="text" class="mg-edit-title" value="${escHtml(g.title)}" placeholder="Goal title..." />
        <input type="text" class="mg-edit-desc" value="${escHtml(g.desc||'')}" placeholder="Description..." />
        <input type="date" class="mg-edit-due" value="${g.due||''}" />
        <select class="mg-edit-status">
          <option value="ON TRACK" ${g.status==='ON TRACK'?'selected':''}>ON TRACK</option>
          <option value="AT RISK" ${g.status==='AT RISK'?'selected':''}>AT RISK</option>
          <option value="COMPLETE" ${g.status==='COMPLETE'?'selected':''}>COMPLETE</option>
        </select>
        <div class="form-btns">
          <button class="btn-primary mg-edit-save">SAVE</button>
          <button class="btn-ghost mg-edit-cancel">CANCEL</button>
        </div>
      </div>`;

    const slider = div.querySelector('.goal-slider');
    slider.addEventListener('input', () => {
      const goals2 = (load(KEYS.monthly)||{})[mn]||[];
      goals2[i].progress = parseInt(slider.value);
      if (parseInt(slider.value) === 100) goals2[i].status = 'COMPLETE';
      document.getElementById(`gpct-${i}`).textContent = slider.value + '%';
      const all2 = load(KEYS.monthly) || {};
      all2[mn] = goals2;
      save(KEYS.monthly, all2);
    });

    // Cycle status badge
    div.querySelector('.status-badge').addEventListener('click', () => {
      const statuses = ['ON TRACK','AT RISK','COMPLETE'];
      const goals2 = (load(KEYS.monthly)||{})[mn]||[];
      const cur = goals2[i].status || 'ON TRACK';
      goals2[i].status = statuses[(statuses.indexOf(cur)+1) % statuses.length];
      const all2 = load(KEYS.monthly)||{};
      all2[mn] = goals2;
      save(KEYS.monthly, all2);
      renderMonthlyGoals();
    });

    // Delete
    div.querySelector('.monthly-del-btn').addEventListener('click', () => {
      const all2 = load(KEYS.monthly)||{};
      all2[mn] = (all2[mn]||[]).filter((_, idx) => idx !== i);
      save(KEYS.monthly, all2);
      renderMonthlyGoals();
    });

    // Edit
    div.querySelector('.monthly-edit-btn').addEventListener('click', () => {
      const form = div.querySelector('.task-edit-form');
      const isOpen = !form.classList.contains('hidden');
      document.querySelectorAll('.task-edit-form').forEach(f => f.classList.add('hidden'));
      if (!isOpen) { form.classList.remove('hidden'); div.querySelector('.mg-edit-title').focus(); }
    });
    div.querySelector('.mg-edit-save').addEventListener('click', () => {
      const all2 = load(KEYS.monthly)||{};
      const goals2 = all2[mn]||[];
      goals2[i].title = div.querySelector('.mg-edit-title').value.trim() || goals2[i].title;
      goals2[i].desc = div.querySelector('.mg-edit-desc').value.trim();
      goals2[i].due = div.querySelector('.mg-edit-due').value;
      goals2[i].status = div.querySelector('.mg-edit-status').value;
      all2[mn] = goals2;
      save(KEYS.monthly, all2);
      renderMonthlyGoals();
    });
    div.querySelector('.mg-edit-cancel').addEventListener('click', () => {
      div.querySelector('.task-edit-form').classList.add('hidden');
    });

    list.appendChild(div);
  });
  renderCalStrip();
}

function addMonthlyGoal() {
  const title = document.getElementById('new-monthly-title').value.trim();
  if (!title) return;
  const mn = monthKey();
  const all = load(KEYS.monthly) || {};
  if (!all[mn]) all[mn] = [];
  all[mn].push({
    id: Date.now(), title,
    desc: document.getElementById('new-monthly-desc').value.trim(),
    due: document.getElementById('new-monthly-due').value,
    progress: 0, status: 'ON TRACK',
  });
  save(KEYS.monthly, all);
  document.getElementById('new-monthly-title').value = '';
  document.getElementById('new-monthly-desc').value = '';
  document.getElementById('new-monthly-due').value = '';
  document.getElementById('add-monthly-form').classList.add('hidden');
  renderMonthlyGoals();
}

function renderCalStrip() {
  const strip = document.getElementById('cal-strip');
  strip.innerHTML = '';
  const d = new Date();
  const year = d.getFullYear(), month = d.getMonth();
  const daysInMonth = new Date(year, month+1, 0).getDate();
  const todayN = d.getDate();
  const all = load(KEYS.tasks) || {};

  for (let i = 1; i <= daysInMonth; i++) {
    const key = `${year}-${String(month+1).padStart(2,'0')}-${String(i).padStart(2,'0')}`;
    const tasks = all[key] || [];
    const hit = tasks.length > 0 && tasks.every(t => t.done);
    const el = document.createElement('div');
    el.className = 'cal-day' + (hit ? ' hit' : '') + (i === todayN ? ' today' : '');
    el.textContent = i;
    strip.appendChild(el);
  }
}

// =============================================
// STREAK SYSTEM
// =============================================
function updateStreakPanel() {
  const tasks = getTodayTasks();
  const meals = getTodayMeals();
  const s = getSettings();
  const steps = getTodaySteps();
  const sleep = getSleepToday();
  const workouts = load(KEYS.workouts) || {};
  const todayStr = today();
  const wout = workouts[todayStr];
  const split = s.split || DEFAULT_SETTINGS.split;
  const dayIdx = new Date().getDay();
  const splitToday = split[dayIdx === 0 ? 6 : dayIdx - 1];

  const taskOk = tasks.filter(t => t.done).length >= 1;
  const calTotal = meals.reduce((a,m) => a + (m.calories||0), 0);
  const calOk = calTotal >= s.calories * 0.9 && calTotal <= s.calories * 1.1;
  const stepsOk = steps >= 8000;
  const sleepOk = !!sleep;
  const workoutOk = splitToday === 'REST' ? true : !!wout;

  const checks = [
    { label: 'Business task', ok: taskOk },
    { label: 'Workout / rest', ok: workoutOk },
    { label: 'Calories on target', ok: calOk },
    { label: 'Steps 8k+', ok: stepsOk },
    { label: 'Sleep logged', ok: sleepOk },
  ];

  const allOk = checks.every(c => c.ok);
  if (allOk) {
    const sData = load(KEYS.streaks) || { count: 0, lastDate: null };
    if (sData.lastDate !== todayStr) {
      sData.lastDate = todayStr;
      sData.count = (sData.count || 0) + 1;
      save(KEYS.streaks, sData);
    }
  }

  const streak = load(KEYS.streaks) || { count: 0 };
  document.getElementById('streak-display').textContent = streak.count;
  document.getElementById('sb-streak').textContent = `${streak.count}d`;

  const checksEl = document.getElementById('streak-checks');
  checksEl.innerHTML = checks.map(c => `
    <div class="streak-check-item">
      <div class="streak-check-dot ${c.ok ? 'ok' : ''}"></div>
      <span>${c.label}</span>
    </div>`).join('');

  const milestones = [7,30,90,365];
  const milEl = document.getElementById('streak-milestones');
  milEl.innerHTML = milestones.map(m => `
    <div class="milestone ${streak.count >= m ? 'reached' : ''}">${m}d${streak.count >= m ? ' ✓' : ''}</div>`).join('');
}

function checkStreakUpdate() { updateStreakPanel(); }

// =============================================
// TRAINING
// =============================================
let workoutStartTime = null;
let workoutTimerInterval = null;

function renderWeekSched() {
  const s = getSettings();
  const split = s.split;
  const days = ['MON','TUE','WED','THU','FRI','SAT','SUN'];
  const today = new Date();
  const dayIdx = today.getDay();
  const todayAdjusted = dayIdx === 0 ? 6 : dayIdx - 1;
  const el = document.getElementById('week-sched');
  el.innerHTML = days.map((d, i) => `
    <div class="week-day-block ${split[i]} ${i === todayAdjusted ? 'today-block' : ''}">
      <div class="day-name">${d}</div>
      <div class="day-type">${split[i]}</div>
    </div>`).join('');
}

function renderTodayWorkout() {
  const s = getSettings();
  const split = s.split;
  const dayIdx = new Date().getDay();
  const adjusted = dayIdx === 0 ? 6 : dayIdx - 1;
  const todayType = split[adjusted];
  document.getElementById('workout-title').textContent = `TODAY — ${todayType}`;

  const exLib = getExercises();
  let ids = [];
  if (todayType === 'PUSH') ids = PUSH_IDS;
  else if (todayType === 'PULL') ids = PULL_IDS;
  else if (todayType === 'LEGS') ids = LEGS_IDS;

  const exercises = ids.map(id => exLib.find(e => e.id === id)).filter(Boolean);
  const list = document.getElementById('exercise-list');

  if (todayType === 'REST') {
    list.innerHTML = '<div style="text-align:center;padding:30px;color:var(--text-muted);font-family:var(--font-head);font-size:14px;letter-spacing:0.1em">REST DAY — RECOVER</div>';
    document.getElementById('start-workout-btn').style.display = 'none';
    return;
  }

  const workouts = load(KEYS.workouts) || {};
  const todayWout = workouts[today()] || {};
  const prevWout = getPrevWorkout(todayType);

  list.innerHTML = '';
  exercises.forEach(ex => {
    const logged = todayWout[ex.id] || [];
    const prev = prevWout[ex.id];
    const prevText = prev && prev.length ? `Last: ${prev[0].weight}kg × ${prev[0].reps}` : 'No previous data';
    const isPB = checkPB(ex.id, logged);
    const readyToProgress = checkProgress(ex.id);

    const row = document.createElement('div');
    row.className = 'exercise-row';
    row.innerHTML = `
      <div class="exercise-row-header">
        <span class="exercise-name">${ex.name}</span>
        ${isPB ? `<span class="pb-badge">PB!</span>` : ''}
        ${readyToProgress ? `<span class="progress-badge">+2.5kg READY</span>` : ''}
      </div>
      <div class="exercise-sets" id="sets-${ex.id}"></div>
      <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
        <span class="exercise-prev">${prevText}</span>
        <button class="btn-log-set" data-exid="${ex.id}">LOG SET</button>
      </div>
      <div class="exercise-notes">
        <input type="text" placeholder="Notes..." data-exid="${ex.id}" value="${todayWout[ex.id+'_notes']||''}" />
      </div>`;

    renderSetRows(row.querySelector(`#sets-${ex.id}`), ex, logged);

    row.querySelector('.btn-log-set').addEventListener('click', () => logSet(ex.id, ex));
    row.querySelector('.exercise-notes input').addEventListener('change', e => {
      const w = load(KEYS.workouts) || {};
      if (!w[today()]) w[today()] = {};
      w[today()][ex.id+'_notes'] = e.target.value;
      save(KEYS.workouts, w);
    });

    list.appendChild(row);
  });
}

function renderSetRows(container, ex, logged) {
  container.innerHTML = '';
  const count = Math.max(ex.sets, logged.length);
  for (let i = 0; i < count; i++) {
    const s = logged[i];
    const div = document.createElement('div');
    div.className = 'set-row' + (s ? ' set-logged' : '');
    div.innerHTML = `
      <span style="font-family:var(--font-head);font-size:10px;color:var(--text-muted)">${i+1}</span>
      <input type="number" value="${s ? s.weight : ''}" placeholder="${ex.weight||''}" data-set="${i}" data-field="weight" />
      <span class="set-sep">×</span>
      <input type="number" value="${s ? s.reps : ex.reps}" data-set="${i}" data-field="reps" />
      <span class="set-unit">kg</span>
      ${s ? '<span style="color:var(--success);font-size:10px">✓</span>' : ''}`;
    container.appendChild(div);
  }
}

function logSet(exId, ex) {
  const w = load(KEYS.workouts) || {};
  if (!w[today()]) w[today()] = {};
  if (!w[today()][exId]) w[today()][exId] = [];
  const row = document.querySelector(`#sets-${exId}`);
  const inputs = row ? row.querySelectorAll('.set-row') : [];
  const nextIdx = w[today()][exId].length;
  const setRow = inputs[nextIdx];
  if (!setRow) return;
  const weight = parseFloat(setRow.querySelector('[data-field="weight"]').value) || 0;
  const reps = parseInt(setRow.querySelector('[data-field="reps"]').value) || ex.reps;
  w[today()][exId].push({ weight, reps, timestamp: Date.now() });
  save(KEYS.workouts, w);
  renderTodayWorkout();
}

function getPrevWorkout(type) {
  const w = load(KEYS.workouts) || {};
  const keys = Object.keys(w).sort().reverse();
  for (const k of keys) {
    if (k === today()) continue;
    const ids = type === 'PUSH' ? PUSH_IDS : type === 'PULL' ? PULL_IDS : LEGS_IDS;
    if (ids.some(id => w[k][id] && w[k][id].length)) return w[k];
  }
  return {};
}

function checkPB(exId, currentSets) {
  if (!currentSets.length) return false;
  const best = Math.max(...currentSets.map(s => s.weight * (1 + s.reps/30)));
  const w = load(KEYS.workouts) || {};
  let prevBest = 0;
  Object.keys(w).filter(k => k !== today()).forEach(k => {
    const sets = w[k][exId] || [];
    sets.forEach(s => {
      const e1rm = s.weight * (1 + s.reps/30);
      if (e1rm > prevBest) prevBest = e1rm;
    });
  });
  return best > prevBest && prevBest > 0;
}

function checkProgress(exId) {
  const w = load(KEYS.workouts) || {};
  const sortedDates = Object.keys(w).sort().reverse().slice(0, 3);
  let allHit = 0;
  for (const d of sortedDates) {
    const sets = w[d][exId];
    if (sets && sets.length >= 3) allHit++;
  }
  return allHit >= 2;
}

function startWorkout() {
  workoutStartTime = Date.now();
  document.getElementById('workout-timer').classList.remove('hidden');
  document.getElementById('start-workout-btn').style.display = 'none';
  document.getElementById('finish-workout-btn').style.display = 'inline-flex';
  workoutTimerInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - workoutStartTime) / 1000);
    const h = String(Math.floor(elapsed/3600)).padStart(2,'0');
    const m = String(Math.floor((elapsed%3600)/60)).padStart(2,'0');
    const s2 = String(elapsed%60).padStart(2,'0');
    document.getElementById('workout-elapsed').textContent = `${h}:${m}:${s2}`;
  }, 1000);
}

function finishWorkout() {
  clearInterval(workoutTimerInterval);
  const elapsed = workoutStartTime ? Math.floor((Date.now() - workoutStartTime) / 1000) : 0;
  const mins = Math.floor(elapsed/60);
  workoutStartTime = null;
  document.getElementById('workout-timer').classList.add('hidden');
  document.getElementById('start-workout-btn').style.display = 'inline-flex';
  document.getElementById('finish-workout-btn').style.display = 'none';

  const w = load(KEYS.workouts) || {};
  if (!w[today()]) w[today()] = {};
  w[today()]._meta = { duration: mins, finished: Date.now() };
  save(KEYS.workouts, w);
  launchConfetti();
  updateStatsBar();
  updateStreakPanel();
}

function renderExerciseLibrary() {
  const exs = getExercises();
  const list = document.getElementById('exercise-library-list');
  list.innerHTML = '';
  exs.forEach((ex, i) => {
    const div = document.createElement('div');
    div.className = 'library-item';
    div.innerHTML = `<span class="lib-muscle">${ex.muscle}</span><span class="lib-name">${ex.name}</span><span style="font-size:10px;color:var(--text-dim)">${ex.sets}×${ex.reps}</span>`;
    list.appendChild(div);
  });
}

function addExercise() {
  const name = document.getElementById('ex-name').value.trim();
  if (!name) return;
  const exs = getExercises();
  const newEx = {
    id: 'custom_' + Date.now(), name,
    muscle: document.getElementById('ex-muscle').value,
    sets: parseInt(document.getElementById('ex-sets').value) || 3,
    reps: parseInt(document.getElementById('ex-reps').value) || 10,
  };
  exs.push(newEx);
  save(KEYS.exercises, exs);
  document.getElementById('exercise-modal').classList.add('hidden');
  document.getElementById('ex-name').value = '';
  renderExerciseLibrary();
}

// 1RM Calculator
function calcRM() {
  const w = parseFloat(document.getElementById('rm-weight').value);
  const r = parseInt(document.getElementById('rm-reps').value);
  if (!w || !r) return;
  const rm = w * (1 + r/30);
  document.getElementById('rm-result').textContent = `${rm.toFixed(1)} kg`;
}

// =============================================
// NUTRITION
// =============================================
function renderMacroRings() {
  const s = getSettings();
  const meals = getTodayMeals();
  const totals = meals.reduce((a, m) => ({
    calories: a.calories + (m.calories||0),
    protein: a.protein + (m.protein||0),
    carbs: a.carbs + (m.carbs||0),
    fat: a.fat + (m.fat||0),
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

  const C = 264;
  const setRing = (id, val, max) => {
    const pct = Math.min(val/max, 1);
    document.getElementById(id).style.strokeDashoffset = C - (C * pct);
  };
  setRing('ring-calories', totals.calories, s.calories);
  setRing('ring-protein', totals.protein, s.protein);
  setRing('ring-carbs', totals.carbs, s.carbs);
  setRing('ring-fat', totals.fat, s.fat);

  document.getElementById('cal-val').textContent = totals.calories;
  document.getElementById('pro-val').textContent = totals.protein;
  document.getElementById('carb-val').textContent = totals.carbs;
  document.getElementById('fat-val').textContent = totals.fat;
  document.getElementById('cal-target').textContent = `/${s.calories}`;
  document.getElementById('pro-target').textContent = `/${s.protein}g`;
  document.getElementById('carb-target').textContent = `/${s.carbs}g`;
  document.getElementById('fat-target').textContent = `/${s.fat}g`;

  const deficit = s.calories - totals.calories;
  document.getElementById('deficit-val').textContent = deficit > 0 ? `${deficit} kcal under` : `${Math.abs(deficit)} kcal over`;
  document.getElementById('deficit-val').style.color = deficit > 0 ? 'var(--success)' : 'var(--accent)';

  const weekDeficit = getWeeklyDeficit();
  const fatLossKg = (weekDeficit / 7700).toFixed(2);
  document.getElementById('deficit-proj').textContent = weekDeficit > 0 ? `~${fatLossKg}kg projected this week` : '';

  document.getElementById('phase-badge').textContent = s.phase;
  document.getElementById('phase-badge').dataset.phase = s.phase;

  renderWater();
  updateStatsBar();
}

function getWeeklyDeficit() {
  const s = getSettings();
  const all = load(KEYS.nutrition) || {};
  const d = new Date();
  let total = 0;
  for (let i = 0; i < 7; i++) {
    const date = new Date(d);
    date.setDate(d.getDate() - i);
    const key = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
    const meals = all[key] || [];
    const cal = meals.reduce((a,m) => a + (m.calories||0), 0);
    if (cal > 0) total += (s.calories - cal);
  }
  return total;
}

function renderMealLog() {
  ['Breakfast','Lunch','Dinner','Snacks'].forEach(group => {
    const el = document.getElementById(`meals-${group}`);
    const meals = getTodayMeals().filter(m => m.group === group);
    el.innerHTML = '';
    meals.forEach((m, i) => {
      const allMeals = getTodayMeals();
      const realIdx = allMeals.indexOf(m);
      const div = document.createElement('div');
      div.className = 'meal-item';
      div.innerHTML = `<span class="meal-name">${escHtml(m.name)}</span>
        <div class="meal-macros">
          <span>${m.calories}kcal</span>
          <span style="color:#00aaff">${m.protein}P</span>
          <span style="color:#ffaa00">${m.carbs}C</span>
          <span style="color:#aa44ff">${m.fat}F</span>
        </div>
        <button class="meal-delete" data-i="${realIdx}">&#215;</button>`;
      div.querySelector('.meal-delete').addEventListener('click', () => {
        const ms = getTodayMeals();
        ms.splice(realIdx, 1);
        saveTodayMeals(ms);
        renderMealLog();
        renderMacroRings();
      });
      el.appendChild(div);
    });
  });
}

function addMeal(data) {
  const meals = getTodayMeals();
  meals.push({ ...data, id: Date.now() });
  saveTodayMeals(meals);
  renderMealLog();
  renderMacroRings();
}

function renderPresets() {
  const presets = load(KEYS.presets) || [];
  const list = document.getElementById('preset-list');
  list.innerHTML = '';
  presets.forEach((p, i) => {
    const div = document.createElement('div');
    div.className = 'preset-item';
    div.innerHTML = `<span class="preset-name">${escHtml(p.name)}</span>
      <span style="font-size:10px;color:var(--text-muted)">${p.calories}kcal</span>
      <button class="btn-quick-add" data-i="${i}">+ ADD</button>
      <button class="preset-delete" data-i="${i}">&#215;</button>`;
    div.querySelector('.btn-quick-add').addEventListener('click', () => {
      addMeal({ name: p.name, group: p.group||'Snacks', calories: p.calories, protein: p.protein, carbs: p.carbs, fat: p.fat });
    });
    div.querySelector('.preset-delete').addEventListener('click', () => {
      const ps = load(KEYS.presets) || [];
      ps.splice(i, 1);
      save(KEYS.presets, ps);
      renderPresets();
    });
    list.appendChild(div);
  });
}

function renderMealPlanner() {
  const mp = load(KEYS.mealPlan) || {};
  const days = ['MON','TUE','WED','THU','FRI','SAT','SUN'];
  const rows = ['Breakfast','Lunch','Dinner'];
  let html = '<table class="meal-plan-table"><thead><tr><th></th>';
  days.forEach(d => { html += `<th>${d}</th>`; });
  html += '</tr></thead><tbody>';
  rows.forEach(row => {
    html += `<tr><th>${row}</th>`;
    days.forEach(d => {
      const val = (mp[d] && mp[d][row]) || '';
      html += `<td><textarea class="meal-plan-cell" data-day="${d}" data-row="${row}">${escHtml(val)}</textarea></td>`;
    });
    html += '</tr>';
  });
  html += '</tbody></table>';
  document.getElementById('meal-planner-grid').innerHTML = html;
  document.querySelectorAll('.meal-plan-cell').forEach(cell => {
    cell.addEventListener('change', () => {
      const mp2 = load(KEYS.mealPlan) || {};
      if (!mp2[cell.dataset.day]) mp2[cell.dataset.day] = {};
      mp2[cell.dataset.day][cell.dataset.row] = cell.value;
      save(KEYS.mealPlan, mp2);
    });
  });
}

// Water tracker
function renderWater() {
  const all = load(KEYS.water) || {};
  const cups = all[today()] || 0;
  const target = 12; // 12 × 250ml = 3000ml
  const el = document.getElementById('water-cups');
  el.innerHTML = '';
  for (let i = 0; i < target; i++) {
    const c = document.createElement('div');
    c.className = 'water-cup' + (i < cups ? ' filled' : '');
    c.addEventListener('click', () => {
      const w2 = load(KEYS.water) || {};
      w2[today()] = i < cups ? i : i+1;
      save(KEYS.water, w2);
      renderWater();
    });
    el.appendChild(c);
  }
  document.getElementById('water-val').textContent = `${cups*250} / 3000ml`;
}

// =============================================
// RECOVERY
// =============================================
function renderSleepChart() {
  const all = load(KEYS.sleep) || {};
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    days.push({ key, label: d.toLocaleDateString('en-GB',{weekday:'short'}), data: all[key] });
  }
  const svg = document.getElementById('sleep-chart');
  const W = svg.parentElement.clientWidth || 300;
  const H = 120;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const maxH = 10;
  const bw = (W - 40) / days.length;
  let html = '';
  days.forEach((d, i) => {
    const h = d.data ? d.data.hours : 0;
    const bh = (h/maxH) * (H-30);
    const x = 20 + i * bw + bw*0.1;
    const y = H - 20 - bh;
    const color = h >= 7 ? 'var(--success)' : h >= 6 ? 'var(--warning)' : 'var(--accent)';
    html += `<rect class="chart-bar" x="${x}" y="${y}" width="${bw*0.8}" height="${bh}" fill="${color}" rx="2" />`;
    html += `<text x="${x + bw*0.4}" y="${H-6}" text-anchor="middle" class="chart-label">${d.label}</text>`;
    if (h) html += `<text x="${x + bw*0.4}" y="${y-3}" text-anchor="middle" class="chart-label">${h.toFixed(1)}</text>`;
  });
  svg.innerHTML = html;

  const avg = days.filter(d => d.data).reduce((a,d) => a + d.data.hours, 0) / Math.max(days.filter(d=>d.data).length, 1);
  const el = document.getElementById('sleep-stats');
  const s = getSettings();
  el.innerHTML = `
    <span>7-day avg: <strong style="color:var(--accent)">${avg.toFixed(1)}h</strong></span>
    <span>Target: ${s.sleep}h | Wake: ${s.wake}</span>
    <span>Rec. bedtime: ${calcBedtime(s.wake, s.sleep)}</span>`;
}

function calcBedtime(wake, sleepH) {
  if (!wake) return '--';
  const [h, m] = wake.split(':').map(Number);
  const bed = new Date(2000, 0, 1, h - sleepH, m);
  return `${String(bed.getHours()).padStart(2,'0')}:${String(bed.getMinutes()).padStart(2,'0')}`;
}

function logSleep() {
  const bedtime = document.getElementById('sleep-bedtime').value;
  const wake = document.getElementById('sleep-waketime').value;
  if (!bedtime || !wake) return;
  const [bh, bm] = bedtime.split(':').map(Number);
  const [wh, wm] = wake.split(':').map(Number);
  let hours = (wh*60+wm - bh*60-bm) / 60;
  if (hours < 0) hours += 24;
  const all = load(KEYS.sleep) || {};
  all[today()] = {
    bedtime, wake, hours: Math.round(hours*10)/10,
    quality: parseInt(document.getElementById('sleep-quality').value) || 3,
    notes: document.getElementById('sleep-notes').value,
  };
  save(KEYS.sleep, all);
  renderSleepChart();
  renderCompositeScore();
  updateStatsBar();
  updateStreakPanel();
}

function renderWhoopGauge(score) {
  const svg = document.getElementById('recovery-gauge');
  const radius = 80, cx = 100, cy = 110;
  const startAngle = Math.PI;
  const endAngle = 2 * Math.PI;
  const pct = (score || 0) / 100;
  const sweepAngle = Math.PI * pct;
  const color = score >= 67 ? '#00cc44' : score >= 34 ? '#ff6600' : '#cc0000';

  const sx = cx + radius * Math.cos(startAngle);
  const sy = cy + radius * Math.sin(startAngle);
  const ex = cx + radius * Math.cos(startAngle + sweepAngle);
  const ey = cy + radius * Math.sin(startAngle + sweepAngle);

  svg.innerHTML = `
    <path d="M ${cx-radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx+radius} ${cy}" fill="none" stroke="var(--border2)" stroke-width="12" stroke-linecap="round"/>
    ${score ? `<path d="M ${sx} ${sy} A ${radius} ${radius} 0 ${pct>0.5?1:0} 1 ${ex} ${ey}" fill="none" stroke="${color}" stroke-width="12" stroke-linecap="round"/>` : ''}`;

  document.getElementById('gauge-score').textContent = score || '--';
  document.getElementById('gauge-score').style.color = score ? color : 'var(--text-muted)';
  const status = !score ? 'NO DATA' : score >= 67 ? 'READY' : score >= 34 ? 'MODERATE' : 'REST';
  document.getElementById('gauge-status').textContent = status;
  document.getElementById('gauge-status').style.color = color;
}

function logWhoop() {
  const recovery = parseInt(document.getElementById('whoop-recovery').value) || 0;
  const all = load(KEYS.whoop) || {};
  all[today()] = {
    recovery,
    hrv: parseFloat(document.getElementById('whoop-hrv').value) || 0,
    rhr: parseInt(document.getElementById('whoop-rhr').value) || 0,
    resp: parseFloat(document.getElementById('whoop-resp').value) || 0,
  };
  save(KEYS.whoop, all);
  renderWhoopGauge(recovery);
  renderCompositeScore();
}

function renderStepsSection() {
  const steps = getTodaySteps();
  const s = getSettings();
  document.getElementById('steps-big').textContent = steps.toLocaleString();
  document.getElementById('steps-target-disp').textContent = s.steps.toLocaleString();
  const pct = Math.min((steps/s.steps)*100, 100);
  document.getElementById('steps-bar-fill').style.width = `${pct}%`;
  renderStepsChart();
}

function logSteps() {
  const val = parseInt(document.getElementById('steps-input').value) || 0;
  const all = load(KEYS.steps) || {};
  all[today()] = val;
  save(KEYS.steps, all);
  document.getElementById('steps-input').value = '';
  renderStepsSection();
  renderCompositeScore();
  updateStatsBar();
  updateStreakPanel();
}

function renderStepsChart() {
  const all = load(KEYS.steps) || {};
  const s = getSettings();
  const svg = document.getElementById('steps-chart');
  const W = svg.parentElement.clientWidth || 200;
  const H = 80;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    days.push(all[key] || 0);
  }
  const maxV = Math.max(...days, s.steps);
  const bw = (W-10) / days.length;
  let html = '';
  days.forEach((v, i) => {
    const bh = (v/maxV)*(H-15);
    const color = v >= s.steps ? 'var(--success)' : 'var(--accent)';
    html += `<rect x="${5 + i*bw + bw*0.1}" y="${H-10-bh}" width="${bw*0.8}" height="${bh}" fill="${color}" rx="1" opacity="0.8"/>`;
  });
  svg.innerHTML = html;
}

function renderCompositeScore() {
  const s = getSettings();
  const sleep = getSleepToday();
  const wData = (load(KEYS.whoop)||{})[today()];
  const steps = getTodaySteps();
  const w = load(KEYS.workouts) || {};
  const split = s.split;
  const dayIdx = new Date().getDay();
  const adjusted = dayIdx === 0 ? 6 : dayIdx - 1;
  const todayType = split[adjusted];
  const woutOk = todayType === 'REST' ? 1 : (w[today()] ? 1 : 0);

  const sleepScore = sleep ? Math.min(sleep.hours / s.sleep, 1) * 100 : 0;
  const whoopScore = wData ? wData.recovery : 0;
  const stepsScore = Math.min(steps / s.steps, 1) * 100;
  const workoutScore = woutOk * 100;

  const composite = Math.round(
    sleepScore * 0.30 +
    whoopScore * 0.40 +
    stepsScore * 0.15 +
    workoutScore * 0.15
  );

  document.getElementById('composite-score').textContent = composite;
  const color = composite >= 67 ? 'var(--success)' : composite >= 34 ? 'var(--warning)' : 'var(--accent)';
  document.getElementById('composite-score').style.color = color;

  const breakdown = [
    { label: 'Sleep (30%)', val: sleepScore, weight: 0.3 },
    { label: 'Whoop (40%)', val: whoopScore, weight: 0.4 },
    { label: 'Steps (15%)', val: stepsScore, weight: 0.15 },
    { label: 'Workout (15%)', val: workoutScore, weight: 0.15 },
  ];
  document.getElementById('composite-breakdown').innerHTML = breakdown.map(b => `
    <div class="comp-row">
      <span class="comp-row-label">${b.label}</span>
      <div class="comp-row-bar"><div class="comp-row-fill" style="width:${b.val}%"></div></div>
      <span class="comp-row-val">${Math.round(b.val)}</span>
    </div>`).join('');
}

function renderMoodStars() {
  const all = load(KEYS.mindset) || {};
  const td = all[today()] || {};
  const mood = td.mood || 0;
  const el = document.getElementById('mood-stars');
  el.innerHTML = '';
  for (let i = 1; i <= 5; i++) {
    const star = document.createElement('div');
    star.className = 'mood-star' + (i <= mood ? ' lit' : '');
    star.textContent = '★';
    star.dataset.val = i;
    star.addEventListener('click', () => setMood(i));
    el.appendChild(star);
  }
  if (td.journal !== undefined) document.getElementById('mindset-journal').value = td.journal || '';
  if (td.win !== undefined) document.getElementById('mindset-win').value = td.win || '';
  if (td.improve !== undefined) document.getElementById('mindset-improve').value = td.improve || '';
}

function setMood(val) {
  const all = load(KEYS.mindset) || {};
  if (!all[today()]) all[today()] = {};
  all[today()].mood = val;
  save(KEYS.mindset, all);
  renderMoodStars();
}

function logMindset() {
  const all = load(KEYS.mindset) || {};
  if (!all[today()]) all[today()] = {};
  all[today()].journal = document.getElementById('mindset-journal').value;
  all[today()].win = document.getElementById('mindset-win').value;
  all[today()].improve = document.getElementById('mindset-improve').value;
  save(KEYS.mindset, all);
}

// =============================================
// ANALYTICS
// =============================================
function renderAnalytics() {
  renderTasksChart();
  renderVolumeChart();
  renderMacrosChart();
  renderSleepTrendChart();
  renderWeightChart();
  renderGoalStats();
}

function renderTasksChart() {
  const all = load(KEYS.tasks) || {};
  const svg = document.getElementById('chart-tasks-30');
  const W = svg.parentElement.clientWidth || 300;
  const H = 120;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const days = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const tasks = all[key] || [];
    days.push(tasks.filter(t => t.done).length);
  }
  const maxV = Math.max(...days, 1);
  const bw = W / days.length;
  svg.innerHTML = days.map((v, i) => {
    const bh = (v/maxV)*(H-20);
    return `<rect x="${i*bw + bw*0.1}" y="${H-10-bh}" width="${bw*0.8}" height="${bh}" fill="var(--accent)" rx="1" opacity="0.8"/>`;
  }).join('');
}

function renderVolumeChart() {
  const w = load(KEYS.workouts) || {};
  const svg = document.getElementById('chart-volume');
  const W = svg.parentElement.clientWidth || 300;
  const H = 120;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const days = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const wout = w[key] || {};
    let vol = 0;
    Object.keys(wout).forEach(k => {
      if (k.startsWith('_')) return;
      const sets = wout[k];
      if (Array.isArray(sets)) sets.forEach(s => { vol += (s.weight||0) * (s.reps||0); });
    });
    days.push(vol);
  }
  const maxV = Math.max(...days, 1);
  const bw = W / days.length;
  svg.innerHTML = days.map((v, i) => {
    const bh = (v/maxV)*(H-20);
    return `<rect x="${i*bw+bw*0.1}" y="${H-10-bh}" width="${bw*0.8}" height="${bh}" fill="var(--accent)" rx="1" opacity="0.7"/>`;
  }).join('');
}

function renderMacrosChart() {
  const s = getSettings();
  const all = load(KEYS.nutrition) || {};
  const svg = document.getElementById('chart-macros');
  const W = svg.parentElement.clientWidth || 300;
  const H = 120;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const days = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const meals = all[key] || [];
    const cal = meals.reduce((a,m) => a+(m.calories||0), 0);
    days.push(cal);
  }
  const bw = W / days.length;
  svg.innerHTML = days.map((v, i) => {
    const pct = Math.min(v / s.calories, 1.3);
    const bh = pct * (H-20);
    const color = v >= s.calories*0.9 && v <= s.calories*1.1 ? 'var(--success)' : v > s.calories*1.1 ? 'var(--accent)' : 'var(--warning)';
    return `<rect x="${i*bw+bw*0.1}" y="${H-10-bh}" width="${bw*0.8}" height="${bh}" fill="${color}" rx="1" opacity="0.8"/>`;
  }).join('');
}

function renderSleepTrendChart() {
  const all = load(KEYS.sleep) || {};
  const svg = document.getElementById('chart-sleep-trend');
  const W = svg.parentElement.clientWidth || 300;
  const H = 120;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const days = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    days.push(all[key] ? all[key].hours : null);
  }
  const maxV = 10;
  const pts = days.map((v, i) => v !== null ? `${(i / (days.length-1)) * (W-20) + 10},${H-10-(v/maxV)*(H-20)}` : null).filter(Boolean);
  if (pts.length < 2) { svg.innerHTML = '<text x="50%" y="50%" text-anchor="middle" class="chart-label">No data yet</text>'; return; }
  svg.innerHTML = `<polyline points="${pts.join(' ')}" fill="none" stroke="var(--accent)" stroke-width="2"/>
    ${pts.map(p => `<circle cx="${p.split(',')[0]}" cy="${p.split(',')[1]}" r="3" fill="var(--accent)"/>`).join('')}`;
}

function renderWeightChart() {
  const all = load(KEYS.weight) || {};
  const svg = document.getElementById('chart-weight');
  const W = svg.parentElement.clientWidth || 300;
  const H = 120;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const entries = Object.keys(all).sort().slice(-20).map(k => all[k]);
  if (entries.length < 2) { svg.innerHTML = '<text x="50%" y="50%" text-anchor="middle" class="chart-label">Log weight to see trend</text>'; return; }
  const minV = Math.min(...entries) - 1;
  const maxV = Math.max(...entries) + 1;
  const pts = entries.map((v, i) => `${(i/(entries.length-1))*(W-20)+10},${H-10-((v-minV)/(maxV-minV))*(H-20)}`);
  svg.innerHTML = `<polyline points="${pts.join(' ')}" fill="none" stroke="var(--accent)" stroke-width="2"/>
    ${pts.map(p => `<circle cx="${p.split(',')[0]}" cy="${p.split(',')[1]}" r="3" fill="var(--accent)"/>`).join('')}`;
}

function renderGoalStats() {
  const habits = load(KEYS.habits) || [];
  const avgStreak = habits.length ? Math.round(habits.reduce((a,h) => a+(h.streak||0), 0)/habits.length) : 0;
  const mn = monthKey();
  const monthly = (load(KEYS.monthly)||{})[mn] || [];
  const completedMonthly = monthly.filter(g => g.status === 'COMPLETE').length;
  const el = document.getElementById('goal-stats');
  el.innerHTML = `
    <div class="goal-stat-row"><span class="goal-stat-label">Avg habit streak</span><span class="goal-stat-val">${avgStreak}d</span></div>
    <div class="goal-stat-row"><span class="goal-stat-label">Monthly goals complete</span><span class="goal-stat-val">${completedMonthly}/${monthly.length}</span></div>
    <div class="goal-stat-row"><span class="goal-stat-label">Active habits</span><span class="goal-stat-val">${habits.length}</span></div>`;
}

// =============================================
// SETTINGS
// =============================================
function openSettings() {
  const s = getSettings();
  document.getElementById('set-calories').value = s.calories;
  document.getElementById('set-protein').value = s.protein;
  document.getElementById('set-carbs').value = s.carbs;
  document.getElementById('set-fat').value = s.fat;
  document.getElementById('set-phase').value = s.phase;
  document.getElementById('set-steps').value = s.steps;
  document.getElementById('set-sleep').value = s.sleep;
  document.getElementById('set-wake').value = s.wake;
  document.querySelectorAll('.swatch').forEach(sw => {
    sw.classList.toggle('active', sw.dataset.color === s.accent);
  });
  document.getElementById('settings-modal').classList.remove('hidden');
}

function saveSettings() {
  const cur = load(KEYS.settings) || {};
  const accent = document.querySelector('.swatch.active')?.dataset.color || '#cc0000';
  const s = {
    ...cur,
    calories: parseInt(document.getElementById('set-calories').value) || 2000,
    protein: parseInt(document.getElementById('set-protein').value) || 200,
    carbs: parseInt(document.getElementById('set-carbs').value) || 100,
    fat: parseInt(document.getElementById('set-fat').value) || 75,
    phase: document.getElementById('set-phase').value,
    steps: parseInt(document.getElementById('set-steps').value) || 10000,
    sleep: parseFloat(document.getElementById('set-sleep').value) || 8,
    wake: document.getElementById('set-wake').value,
    accent,
  };
  save(KEYS.settings, s);
  applyTheme(accent);
  document.getElementById('settings-modal').classList.add('hidden');
  renderMacroRings();
  renderStepsSection();
  renderSleepChart();
  updateStatsBar();
}

function applyTheme(accent) {
  document.documentElement.style.setProperty('--accent', accent);
  const hot = lightenColor(accent, 30);
  document.documentElement.style.setProperty('--accent-hot', hot);
  document.documentElement.style.setProperty('--accent-dim', hexToRgba(accent, 0.15));
  document.documentElement.style.setProperty('--accent-glow', hexToRgba(accent, 0.3));
}

function hexToRgba(hex, a) {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${a})`;
}

function lightenColor(hex, amt) {
  const r = Math.min(255, parseInt(hex.slice(1,3),16)+amt);
  const g = Math.min(255, parseInt(hex.slice(3,5),16)+amt);
  const b = Math.min(255, parseInt(hex.slice(5,7),16)+amt);
  return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
}

// =============================================
// SPLIT EDITOR
// =============================================
function openSplitEditor() {
  const s = getSettings();
  const split = s.split || DEFAULT_SETTINGS.split;
  const days = ['MON','TUE','WED','THU','FRI','SAT','SUN'];
  const opts = ['PUSH','PULL','LEGS','REST'];
  document.getElementById('split-editor').innerHTML = days.map((d, i) => `
    <div class="split-day-row">
      <label>${d}</label>
      <select data-day="${i}">
        ${opts.map(o => `<option value="${o}" ${split[i]===o?'selected':''}>${o}</option>`).join('')}
      </select>
    </div>`).join('');
  document.getElementById('split-modal').classList.remove('hidden');
}

function saveSplit() {
  const s = load(KEYS.settings) || {};
  const selects = document.querySelectorAll('#split-editor select');
  s.split = Array.from(selects).map(sel => sel.value);
  save(KEYS.settings, s);
  document.getElementById('split-modal').classList.add('hidden');
  renderWeekSched();
  renderTodayWorkout();
}

// =============================================
// FOCUS MODE
// =============================================
let focusRunning = false, focusInterval = null, focusTimeLeft = 25*60, focusIsWork = true;

function enterFocusMode() {
  document.getElementById('focus-overlay').classList.remove('hidden');
  renderFocusTasks();
}

function exitFocusMode() {
  document.getElementById('focus-overlay').classList.add('hidden');
  clearInterval(focusInterval);
  focusRunning = false;
}

function renderFocusTasks() {
  const tasks = getTodayTasks().filter(t => !t.done);
  document.getElementById('focus-tasks').innerHTML = tasks.slice(0,5).map((t,i) => `
    <div class="task-item">
      <div class="task-check" onclick="toggleTask(${getTodayTasks().indexOf(t)});renderFocusTasks()"></div>
      <div class="task-body"><div class="task-name">${escHtml(t.name)}</div></div>
    </div>`).join('');
}

function updateFocusDisplay() {
  const m = String(Math.floor(focusTimeLeft/60)).padStart(2,'0');
  const s = String(focusTimeLeft%60).padStart(2,'0');
  document.getElementById('focus-timer-display').textContent = `${m}:${s}`;
  document.getElementById('focus-timer-phase').textContent = focusIsWork ? 'WORK SESSION' : 'REST';
}

function startFocusTimer() {
  if (focusRunning) return;
  focusRunning = true;
  focusInterval = setInterval(() => {
    focusTimeLeft--;
    if (focusTimeLeft <= 0) {
      focusIsWork = !focusIsWork;
      focusTimeLeft = focusIsWork ? 25*60 : 5*60;
    }
    updateFocusDisplay();
  }, 1000);
}

function resetFocusTimer() {
  clearInterval(focusInterval);
  focusRunning = false;
  focusIsWork = true;
  focusTimeLeft = 25*60;
  updateFocusDisplay();
}

// =============================================
// MORNING BRIEF
// =============================================
function checkMorningBrief() {
  const lastBrief = localStorage.getItem('pct_last_brief');
  const td = today();
  if (lastBrief === td) return;
  localStorage.setItem('pct_last_brief', td);

  const s = getSettings();
  const split = s.split;
  const dayIdx = new Date().getDay();
  const adjusted = dayIdx === 0 ? 6 : dayIdx - 1;
  const todayType = split[adjusted];
  const tasks = getTodayTasks().filter(t => t.priority === 'CRITICAL' || t.priority === 'HIGH').slice(0, 3);
  const streak = (load(KEYS.streaks)||{count:0}).count;
  const composite = document.getElementById('composite-score').textContent;

  document.getElementById('mb-date').textContent = todayLabel();
  document.getElementById('mb-content').innerHTML = `
    <div class="mb-section">
      <div class="mb-section-title">COMMANDER STREAK</div>
      <div class="mb-score">${streak}d</div>
    </div>
    <div class="mb-section">
      <div class="mb-section-title">TODAY'S TRAINING</div>
      <div style="font-size:18px;font-family:var(--font-head);color:var(--accent);font-weight:900">${todayType}</div>
    </div>
    <div class="mb-section">
      <div class="mb-section-title">NUTRITION TARGET</div>
      <div style="font-size:13px;color:var(--text-muted)">${s.calories} kcal | ${s.protein}g protein | ${s.carbs}g carbs | ${s.fat}g fat</div>
    </div>
    ${tasks.length ? `<div class="mb-section">
      <div class="mb-section-title">TOP PRIORITIES</div>
      ${tasks.map(t => `<div style="font-size:13px;padding:2px 0">${escHtml(t.name)}</div>`).join('')}
    </div>` : ''}`;

  document.getElementById('morning-modal').classList.remove('hidden');
}

// =============================================
// WEEKLY REVIEW
// =============================================
function checkWeeklyReview() {
  const d = new Date();
  if (d.getDay() !== 0) return;
  const lastReview = localStorage.getItem('pct_last_review');
  const wk = `${d.getFullYear()}-W${Math.ceil(d.getDate()/7)}`;
  if (lastReview === wk) return;
  const questions = [
    { id:'q1', label:'Rate your productivity this week (1-10)', type:'range', min:1, max:10 },
    { id:'q2', label:'Rate your training consistency (1-10)', type:'range', min:1, max:10 },
    { id:'q3', label:'Rate your nutrition adherence (1-10)', type:'range', min:1, max:10 },
    { id:'q4', label:'Biggest win this week', type:'text' },
    { id:'q5', label:'What will you do differently next week?', type:'textarea' },
  ];
  document.getElementById('weekly-review-questions').innerHTML = questions.map(q => `
    <div class="review-q">
      <label>${q.label}</label>
      ${q.type === 'range' ? `<input type="range" id="${q.id}" min="${q.min}" max="${q.max}" value="${Math.ceil((q.max-q.min)/2)+q.min}" />` :
        q.type === 'textarea' ? `<textarea id="${q.id}" rows="2"></textarea>` :
        `<input type="text" id="${q.id}" />`}
    </div>`).join('');
  document.getElementById('weekly-review-modal').classList.remove('hidden');
}

function saveWeeklyReview() {
  const d = new Date();
  const wk = `${d.getFullYear()}-W${Math.ceil(d.getDate()/7)}`;
  const data = { week: wk };
  ['q1','q2','q3','q4','q5'].forEach(id => {
    const el = document.getElementById(id);
    if (el) data[id] = el.value;
  });
  const reviews = load(KEYS.weeklyReview) || [];
  reviews.push(data);
  save(KEYS.weeklyReview, reviews);
  localStorage.setItem('pct_last_review', wk);
  document.getElementById('weekly-review-modal').classList.add('hidden');
}

// =============================================
// DATA EXPORT / IMPORT
// =============================================
function exportData() {
  const data = {};
  Object.values(KEYS).forEach(k => { data[k] = load(k); });
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `command-center-backup-${today()}.json`;
  a.click();
}

function importData(file) {
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target.result);
      Object.keys(data).forEach(k => { if (data[k] !== null) save(k, data[k]); });
      location.reload();
    } catch { alert('Invalid backup file.'); }
  };
  reader.readAsText(file);
}

// =============================================
// CONFETTI
// =============================================
function launchConfetti() {
  const canvas = document.createElement('canvas');
  canvas.id = 'confetti-canvas';
  canvas.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:500;';
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const particles = Array.from({ length: 80 }, () => ({
    x: Math.random() * canvas.width,
    y: -10,
    vx: (Math.random()-0.5)*4,
    vy: Math.random()*3+2,
    size: Math.random()*6+3,
    color: ['#cc0000','#ff1a1a','#ff6600','#ffffff','#880000'][Math.floor(Math.random()*5)],
    angle: Math.random()*Math.PI*2,
    spin: (Math.random()-0.5)*0.2,
  }));

  let frame = 0;
  const anim = () => {
    ctx.clearRect(0,0,canvas.width,canvas.height);
    particles.forEach(p => {
      p.x += p.vx; p.y += p.vy; p.angle += p.spin;
      ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.angle);
      ctx.fillStyle = p.color; ctx.fillRect(-p.size/2,-p.size/2,p.size,p.size);
      ctx.restore();
    });
    frame++;
    if (frame < 120) requestAnimationFrame(anim);
    else canvas.remove();
  };
  requestAnimationFrame(anim);
}

// =============================================
// AMAZON FBA
// =============================================

// --- Purchase List ---
function renderFbaBuyList() {
  const items = load(KEYS.fbaBuyList) || [];
  const list = document.getElementById('fba-buy-list');
  const sourced = items.filter(i => i.done).length;
  document.getElementById('fba-buy-stat').textContent = `${sourced}/${items.length} sourced`;
  const fill = document.getElementById('fba-buy-progress-fill');
  fill.style.width = items.length ? `${(sourced/items.length)*100}%` : '0%';
  list.innerHTML = '';
  items.forEach((item, i) => {
    const div = document.createElement('div');
    div.className = 'fba-buy-item' + (item.done ? ' sourced' : '');
    div.draggable = true;
    div.dataset.index = i;
    div.innerHTML = `
      <div class="fba-buy-check ${item.done ? 'checked' : ''}" data-i="${i}"></div>
      <div class="fba-buy-body">
        <div class="fba-buy-name ${item.done ? 'done' : ''}">${escHtml(item.name)}</div>
        <div class="fba-buy-meta">
          <span class="priority-badge priority-${item.priority}">${item.priority}</span>
          ${item.category ? `<span class="category-tag">${escHtml(item.category)}</span>` : ''}
          ${item.budget ? `<span class="fba-buy-budget">£${item.budget}</span>` : ''}
        </div>
        ${item.notes ? `<div class="fba-buy-notes-text">${escHtml(item.notes)}</div>` : ''}
      </div>
      <div class="task-actions">
        <button class="fba-buy-edit" title="Edit">&#9998;</button>
        <button class="fba-buy-delete" data-i="${i}" title="Delete">&#215;</button>
      </div>
      <div class="task-edit-form hidden" style="width:100%;margin-top:6px">
        <input type="text" class="fba-edit-name" value="${escHtml(item.name)}" placeholder="Brand / Product..." />
        <div style="display:flex;gap:4px;flex-wrap:wrap">
          <select class="fba-edit-priority">
            <option value="URGENT" ${item.priority==='URGENT'?'selected':''}>URGENT</option>
            <option value="HIGH" ${item.priority==='HIGH'?'selected':''}>HIGH</option>
            <option value="MEDIUM" ${item.priority==='MEDIUM'?'selected':''}>MEDIUM</option>
            <option value="LOW" ${item.priority==='LOW'?'selected':''}>LOW</option>
          </select>
          <input type="text" class="fba-edit-cat" value="${escHtml(item.category||'')}" placeholder="Category" style="flex:1;min-width:80px" />
          <input type="number" class="fba-edit-budget" value="${item.budget||''}" placeholder="£" style="width:60px" step="0.01" />
        </div>
        <input type="text" class="fba-edit-notes" value="${escHtml(item.notes||'')}" placeholder="Notes..." />
        <div class="form-btns">
          <button class="btn-primary fba-edit-save">SAVE</button>
          <button class="btn-ghost fba-edit-cancel">CANCEL</button>
        </div>
      </div>`;
    div.querySelector('.fba-buy-check').addEventListener('click', () => {
      const its = load(KEYS.fbaBuyList) || [];
      its[i].done = !its[i].done;
      save(KEYS.fbaBuyList, its);
      renderFbaBuyList();
    });
    div.querySelector('.fba-buy-delete').addEventListener('click', () => {
      const its = load(KEYS.fbaBuyList) || [];
      its.splice(i, 1);
      save(KEYS.fbaBuyList, its);
      renderFbaBuyList();
      renderFbaKpis();
    });
    div.querySelector('.fba-buy-edit').addEventListener('click', () => {
      const form = div.querySelector('.task-edit-form');
      const isOpen = !form.classList.contains('hidden');
      document.querySelectorAll('.task-edit-form').forEach(f => f.classList.add('hidden'));
      if (!isOpen) { form.classList.remove('hidden'); div.querySelector('.fba-edit-name').focus(); }
    });
    div.querySelector('.fba-edit-save').addEventListener('click', () => {
      const its = load(KEYS.fbaBuyList) || [];
      its[i].name = div.querySelector('.fba-edit-name').value.trim() || its[i].name;
      its[i].priority = div.querySelector('.fba-edit-priority').value;
      its[i].category = div.querySelector('.fba-edit-cat').value.trim();
      its[i].budget = div.querySelector('.fba-edit-budget').value;
      its[i].notes = div.querySelector('.fba-edit-notes').value.trim();
      save(KEYS.fbaBuyList, its);
      renderFbaBuyList();
    });
    div.querySelector('.fba-edit-cancel').addEventListener('click', () => {
      div.querySelector('.task-edit-form').classList.add('hidden');
    });
    div.querySelector('.fba-edit-name').addEventListener('keydown', e => {
      if (e.key === 'Enter') div.querySelector('.fba-edit-save').click();
      if (e.key === 'Escape') div.querySelector('.fba-edit-cancel').click();
    });
    // Drag-to-reorder
    div.addEventListener('dragstart', () => { div._dragIdx = i; div.style.opacity='0.5'; });
    div.addEventListener('dragend', () => { div.style.opacity='1'; });
    div.addEventListener('dragover', e => e.preventDefault());
    div.addEventListener('drop', () => {
      const from = parseInt(div._dragIdx ?? i);
      const its = load(KEYS.fbaBuyList) || [];
      const [moved] = its.splice(from, 1);
      its.splice(i, 0, moved);
      save(KEYS.fbaBuyList, its);
      renderFbaBuyList();
    });
    list.appendChild(div);
  });
  renderFbaKpis();
}

function addFbaBuyItem() {
  const name = document.getElementById('fba-buy-name').value.trim();
  if (!name) return;
  const items = load(KEYS.fbaBuyList) || [];
  items.push({
    id: Date.now(), name,
    priority: document.getElementById('fba-buy-priority').value,
    category: document.getElementById('fba-buy-category').value.trim(),
    budget: document.getElementById('fba-buy-budget').value,
    notes: document.getElementById('fba-buy-notes').value.trim(),
    done: false,
  });
  save(KEYS.fbaBuyList, items);
  ['fba-buy-name','fba-buy-category','fba-buy-budget','fba-buy-notes'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('fba-buy-form').classList.add('hidden');
  renderFbaBuyList();
}

// --- Contacts Spreadsheet ---
let editingContactIdx = null;

function renderFbaContacts(filter) {
  let contacts = load(KEYS.fbaContacts) || [];
  if (filter) {
    const q = filter.toLowerCase();
    contacts = contacts.filter(c =>
      (c.brand||'').toLowerCase().includes(q) ||
      (c.email||'').toLowerCase().includes(q) ||
      (c.category||'').toLowerCase().includes(q) ||
      (c.status||'').toLowerCase().includes(q)
    );
  }
  const tbody = document.getElementById('fba-contacts-body');
  tbody.innerHTML = '';
  contacts.forEach((c, idx) => {
    const realIdx = (load(KEYS.fbaContacts)||[]).indexOf(c);
    const tr = document.createElement('tr');
    if (c.status === 'DEAL') tr.classList.add('deal-row');
    tr.innerHTML = `
      <td><input class="fba-cell-input" value="${escHtml(c.brand||'')}" data-field="brand" data-i="${realIdx}" /></td>
      <td><input class="fba-cell-input" value="${escHtml(c.contact||'')}" data-field="contact" data-i="${realIdx}" /></td>
      <td><input class="fba-cell-input" value="${escHtml(c.email||'')}" data-field="email" data-i="${realIdx}" /></td>
      <td><input class="fba-cell-input" value="${escHtml(c.phone||'')}" data-field="phone" data-i="${realIdx}" /></td>
      <td>${c.website ? `<a href="${escHtml(c.website)}" target="_blank" class="sf-open">&#8599;</a>` : '<input class="fba-cell-input" placeholder="https://" data-field="website" data-i="'+realIdx+'" />'}</td>
      <td><input class="fba-cell-input" value="${escHtml(c.distributor||'')}" data-field="distributor" data-i="${realIdx}" /></td>
      <td>
        <span class="fba-status-pill" data-status="${c.status||'TO CONTACT'}" data-i="${realIdx}">${c.status||'TO CONTACT'}</span>
      </td>
      <td><input class="fba-cell-input" value="${escHtml(c.notes||'')}" data-field="notes" data-i="${realIdx}" /></td>
      <td><button class="fba-row-del" data-i="${realIdx}">&#215;</button></td>`;

    // Inline edit on blur
    tr.querySelectorAll('.fba-cell-input').forEach(input => {
      input.addEventListener('blur', () => {
        const all = load(KEYS.fbaContacts) || [];
        const ri = parseInt(input.dataset.i);
        if (all[ri]) { all[ri][input.dataset.field] = input.value; save(KEYS.fbaContacts, all); }
        renderFbaKpis();
        renderPipeline();
      });
    });

    // Cycle status on click
    tr.querySelectorAll('.fba-status-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        const statuses = ['TO CONTACT','CONTACTED','REPLIED','DEAL','PASS'];
        const all = load(KEYS.fbaContacts) || [];
        const ri = parseInt(pill.dataset.i);
        const cur = all[ri].status || 'TO CONTACT';
        const next = statuses[(statuses.indexOf(cur) + 1) % statuses.length];
        all[ri].status = next;
        save(KEYS.fbaContacts, all);
        renderFbaContacts(document.getElementById('fba-contact-search').value);
        renderPipeline();
        renderFbaKpis();
      });
    });

    tr.querySelector('.fba-row-del').addEventListener('click', () => {
      const all = load(KEYS.fbaContacts) || [];
      const ri = parseInt(tr.querySelector('.fba-row-del').dataset.i);
      all.splice(ri, 1);
      save(KEYS.fbaContacts, all);
      renderFbaContacts(document.getElementById('fba-contact-search').value);
      renderPipeline();
      renderFbaKpis();
    });

    tbody.appendChild(tr);
  });
  const total = (load(KEYS.fbaContacts)||[]).length;
  document.getElementById('fba-contacts-footer').textContent = `${total} brand${total !== 1 ? 's' : ''} total`;
}

function openContactModal(idx) {
  editingContactIdx = idx ?? null;
  const all = load(KEYS.fbaContacts) || [];
  const c = idx !== null && idx !== undefined ? all[idx] : {};
  document.getElementById('contact-modal-title').textContent = idx !== null && idx !== undefined ? 'EDIT CONTACT' : 'ADD BRAND CONTACT';
  document.getElementById('c-brand').value = c.brand || '';
  document.getElementById('c-contact').value = c.contact || '';
  document.getElementById('c-email').value = c.email || '';
  document.getElementById('c-phone').value = c.phone || '';
  document.getElementById('c-website').value = c.website || '';
  document.getElementById('c-distributor').value = c.distributor || '';
  document.getElementById('c-category').value = c.category || '';
  document.getElementById('c-status').value = c.status || 'TO CONTACT';
  document.getElementById('c-notes').value = c.notes || '';
  document.getElementById('contact-modal').classList.remove('hidden');
}

function saveContact() {
  const brand = document.getElementById('c-brand').value.trim();
  if (!brand) return;
  const all = load(KEYS.fbaContacts) || [];
  const entry = {
    brand, contact: document.getElementById('c-contact').value.trim(),
    email: document.getElementById('c-email').value.trim(),
    phone: document.getElementById('c-phone').value.trim(),
    website: document.getElementById('c-website').value.trim(),
    distributor: document.getElementById('c-distributor').value.trim(),
    category: document.getElementById('c-category').value.trim(),
    status: document.getElementById('c-status').value,
    notes: document.getElementById('c-notes').value.trim(),
    added: today(),
  };
  if (editingContactIdx !== null) all[editingContactIdx] = { ...all[editingContactIdx], ...entry };
  else all.push(entry);
  save(KEYS.fbaContacts, all);
  document.getElementById('contact-modal').classList.add('hidden');
  renderFbaContacts();
  renderPipeline();
  renderFbaKpis();
}

function exportContactsCsv() {
  const contacts = load(KEYS.fbaContacts) || [];
  const headers = ['Brand','Contact Name','Email','Phone','Website','Distributor','Category','Status','Notes','Added'];
  const rows = contacts.map(c => [
    c.brand, c.contact, c.email, c.phone, c.website,
    c.distributor, c.category, c.status, c.notes, c.added
  ].map(v => `"${(v||'').replace(/"/g,'""')}"`));
  const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `fba-contacts-${today()}.csv`;
  a.click();
}

function importContactsCsv(file) {
  const reader = new FileReader();
  reader.onload = e => {
    const lines = e.target.result.split('\n').filter(l => l.trim());
    const headers = ['brand','contact','email','phone','website','distributor','category','status','notes','added'];
    const existing = load(KEYS.fbaContacts) || [];
    const newEntries = lines.slice(1).map(line => {
      const vals = line.split(',').map(v => v.replace(/^"|"$/g,'').replace(/""/g,'"'));
      const obj = {};
      headers.forEach((h, i) => { obj[h] = vals[i] || ''; });
      return obj;
    }).filter(e => e.brand);
    save(KEYS.fbaContacts, [...existing, ...newEntries]);
    renderFbaContacts();
    renderPipeline();
    renderFbaKpis();
  };
  reader.readAsText(file);
}

// --- Storefronts ---
function renderStorefronts() {
  const sfs = load(KEYS.fbaStorefronts) || [];
  const list = document.getElementById('storefront-list');
  list.innerHTML = '';
  if (!sfs.length) {
    list.innerHTML = '<div style="color:var(--text-dim);font-size:11px;padding:8px 0">No storefronts added yet. Paste Amazon seller storefront URLs above.</div>';
    return;
  }
  sfs.forEach((sf, i) => {
    const div = document.createElement('div');
    div.className = 'storefront-item';
    div.innerHTML = `
      <div style="flex:1;min-width:0">
        <div class="sf-label">${escHtml(sf.label || `Storefront ${i+1}`)}</div>
        <div class="sf-url">${escHtml(sf.url)}</div>
      </div>
      <span class="sf-status ${sf.scraped ? 'scraped' : 'pending'}">${sf.scraped ? 'SCRAPED' : 'PENDING'}</span>
      <a class="sf-open" href="${escHtml(sf.url)}" target="_blank">OPEN &#8599;</a>
      <button class="sf-delete" data-i="${i}">&#215;</button>`;
    div.querySelector('.sf-delete').addEventListener('click', () => {
      const all = load(KEYS.fbaStorefronts) || [];
      all.splice(i, 1);
      save(KEYS.fbaStorefronts, all);
      renderStorefronts();
    });
    list.appendChild(div);
  });
}

function addStorefront() {
  const url = document.getElementById('sf-url-input').value.trim();
  if (!url) return;
  const sfs = load(KEYS.fbaStorefronts) || [];
  sfs.push({ id: Date.now(), url, label: document.getElementById('sf-label-input').value.trim(), scraped: false });
  save(KEYS.fbaStorefronts, sfs);
  document.getElementById('sf-url-input').value = '';
  document.getElementById('sf-label-input').value = '';
  document.getElementById('sf-add-form').classList.add('hidden');
  renderStorefronts();
}

// --- Scrape Prompt Generator ---
function generateScrapePrompt() {
  const sfs = load(KEYS.fbaStorefronts) || [];
  const pending = sfs.filter(sf => !sf.scraped);
  if (!pending.length) {
    alert('No pending storefronts to scrape. Add some first.');
    return;
  }
  const urlList = pending.map((sf, i) => `${i+1}. ${sf.url}${sf.label ? ' ('+sf.label+')' : ''}`).join('\n');
  const prompt = `# Amazon Storefront Brand Scraper

You are an Amazon FBA research assistant. Your job is to visit each Amazon seller storefront listed below, extract every brand that the seller stocks, and then find the contact information for each brand.

## Storefronts to scrape:
${urlList}

## Instructions:

### Step 1 — Extract brands from each storefront
For each storefront URL:
- Use WebFetch to load the storefront page
- Extract every unique brand name from the product listings
- Note the product categories

### Step 2 — Find contact info for each brand
For each brand found:
- Search for their official website (search: "[brand name] official website UK wholesale")
- Find their trade/wholesale contact email if available
- Find a general contact phone number
- Identify if they use a distributor (e.g. search "[brand name] UK distributor wholesale")
- Find the distributor name if applicable

### Step 3 — Output as CSV
Output ONLY a CSV with these exact headers, nothing else before or after:
Brand,Contact Name,Email,Phone,Website,Distributor,Category,Status,Notes,Added

Rules:
- Use "TO CONTACT" for all Status values
- Leave unknown fields blank (empty string between commas)
- Wrap all values in double quotes
- Escape any double quotes inside values as ""
- Today's date for Added field: ${today()}
- Process all ${pending.length} storefronts
- Remove duplicate brands across storefronts

Begin now. Output the CSV when complete.`;

  document.getElementById('scrape-prompt-text').value = prompt;
  document.getElementById('scrape-prompt-modal').classList.remove('hidden');

  // Mark as scraped
  const all = load(KEYS.fbaStorefronts) || [];
  all.forEach(sf => { if (!sf.scraped) sf.scraped = true; });
  save(KEYS.fbaStorefronts, all);
  renderStorefronts();
}

// --- Pipeline ---
function renderPipeline() {
  const contacts = load(KEYS.fbaContacts) || [];
  const stages = ['TO CONTACT','CONTACTED','REPLIED','DEAL'];
  stages.forEach(stage => {
    const el = document.getElementById(`pipe-${stage}`);
    if (!el) return;
    const stageContacts = contacts.filter(c => (c.status || 'TO CONTACT') === stage);
    el.innerHTML = stageContacts.length
      ? stageContacts.map((c, i) => `
          <div class="pipeline-card" title="${escHtml(c.email||'')}">
            <div class="pipeline-card-brand">${escHtml(c.brand)}</div>
            ${c.category ? `<div class="pipeline-card-cat">${escHtml(c.category)}</div>` : ''}
          </div>`).join('')
      : '<div style="color:var(--text-dim);font-size:10px;padding:4px">Empty</div>';
  });
  const active = contacts.filter(c => c.status !== 'PASS').length;
  document.getElementById('fba-pipeline-stat').textContent = `${active} active`;
}

// --- KPI Grid ---
function renderFbaKpis() {
  const contacts = load(KEYS.fbaContacts) || [];
  const buyList = load(KEYS.fbaBuyList) || [];
  const sfs = load(KEYS.fbaStorefronts) || [];
  const deals = contacts.filter(c => c.status === 'DEAL').length;
  const contacted = contacts.filter(c => ['CONTACTED','REPLIED','DEAL'].includes(c.status)).length;
  const replyRate = contacted > 0 ? Math.round((contacts.filter(c => ['REPLIED','DEAL'].includes(c.status)).length / contacted) * 100) : 0;
  const el = document.getElementById('fba-kpi-grid');
  el.innerHTML = `
    <div class="fba-kpi"><div class="fba-kpi-val">${contacts.length}</div><div class="fba-kpi-label">BRANDS</div></div>
    <div class="fba-kpi"><div class="fba-kpi-val" style="color:var(--success)">${deals}</div><div class="fba-kpi-label">DEALS</div></div>
    <div class="fba-kpi"><div class="fba-kpi-val">${replyRate}%</div><div class="fba-kpi-label">REPLY RATE</div></div>
    <div class="fba-kpi"><div class="fba-kpi-val">${sfs.length}</div><div class="fba-kpi-label">STOREFRONTS</div></div>`;
}

async function exportScrapeQueue() {
  const sfs = load(KEYS.fbaStorefronts) || [];
  const pending = sfs.filter(sf => !sf.scraped);
  if (!pending.length) { alert('No pending storefronts to export. Add URLs first.'); return; }

  const json = JSON.stringify(sfs, null, 2);
  const blob = new Blob([json], { type: 'application/json' });

  // Try File System Access API first (Chrome — lets user save directly to project folder)
  if (window.showSaveFilePicker) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: 'scrape-queue.json',
        startIn: 'downloads',
        types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(json);
      await writable.close();
      document.getElementById('scraper-run-box').style.display = 'block';
      return;
    } catch (e) { /* user cancelled or not supported */ }
  }

  // Fallback: standard download
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'scrape-queue.json';
  a.click();
  document.getElementById('scraper-run-box').style.display = 'block';
}

function wireFbaEvents() {
  // Buy list
  document.getElementById('add-buy-btn').addEventListener('click', () => {
    document.getElementById('fba-buy-form').classList.remove('hidden');
    document.getElementById('fba-buy-name').focus();
  });
  document.getElementById('save-buy-btn').addEventListener('click', addFbaBuyItem);
  document.getElementById('cancel-buy-btn').addEventListener('click', () => {
    document.getElementById('fba-buy-form').classList.add('hidden');
  });
  document.getElementById('fba-buy-name').addEventListener('keydown', e => { if (e.key === 'Enter') addFbaBuyItem(); });

  // Contacts
  document.getElementById('add-contact-btn').addEventListener('click', () => openContactModal(null));
  document.getElementById('save-contact-btn').addEventListener('click', saveContact);
  document.getElementById('close-contact-btn').addEventListener('click', () => {
    document.getElementById('contact-modal').classList.add('hidden');
  });
  document.getElementById('export-contacts-csv-btn').addEventListener('click', exportContactsCsv);
  document.getElementById('import-contacts-csv-btn').addEventListener('click', () => {
    document.getElementById('import-contacts-file').click();
  });
  document.getElementById('import-contacts-file').addEventListener('change', e => {
    if (e.target.files[0]) importContactsCsv(e.target.files[0]);
  });
  document.getElementById('fba-contact-search').addEventListener('input', e => {
    renderFbaContacts(e.target.value);
  });

  // Storefronts
  document.getElementById('add-storefront-btn').addEventListener('click', () => {
    document.getElementById('sf-add-form').classList.remove('hidden');
    document.getElementById('sf-url-input').focus();
  });
  document.getElementById('save-sf-btn').addEventListener('click', addStorefront);
  document.getElementById('cancel-sf-btn').addEventListener('click', () => {
    document.getElementById('sf-add-form').classList.add('hidden');
  });
  document.getElementById('sf-url-input').addEventListener('keydown', e => { if (e.key === 'Enter') addStorefront(); });

  // Scraper
  document.getElementById('export-queue-btn').addEventListener('click', exportScrapeQueue);
  document.getElementById('gen-scrape-prompt-btn').addEventListener('click', generateScrapePrompt);
  document.getElementById('clear-scraped-btn').addEventListener('click', () => {
    const all = load(KEYS.fbaStorefronts) || [];
    all.forEach(sf => sf.scraped = false);
    save(KEYS.fbaStorefronts, all);
    renderStorefronts();
  });
  document.getElementById('copy-scrape-prompt-btn').addEventListener('click', () => {
    const text = document.getElementById('scrape-prompt-text').value;
    navigator.clipboard.writeText(text).then(() => {
      document.getElementById('copy-scrape-prompt-btn').textContent = 'COPIED!';
      setTimeout(() => { document.getElementById('copy-scrape-prompt-btn').textContent = 'COPY PROMPT'; }, 2000);
    });
  });
  document.getElementById('close-scrape-prompt-btn').addEventListener('click', () => {
    document.getElementById('scrape-prompt-modal').classList.add('hidden');
  });
}

// =============================================
// KEYBOARD SHORTCUTS
// =============================================
function initKeyboard() {
  document.addEventListener('keydown', e => {
    const tag = e.target.tagName;
    const inInput = ['INPUT','TEXTAREA','SELECT'].includes(tag);

    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay').forEach(m => m.classList.add('hidden'));
      exitFocusMode();
      return;
    }
    if (e.key === 'Enter') {
      if (!document.getElementById('morning-modal').classList.contains('hidden')) {
        document.getElementById('morning-modal').classList.add('hidden'); return;
      }
    }
    if (inInput) return;

    if (e.key >= '1' && e.key <= '6') {
      const tabs = ['command','business','training','nutrition','analytics'];
      switchTab(tabs[parseInt(e.key)-1]);
    }
    if (e.key.toLowerCase() === 't') {
      switchTab('command');
      document.getElementById('add-task-form').classList.remove('hidden');
      document.getElementById('add-task-btn').classList.add('hidden');
      setTimeout(() => document.getElementById('new-task-name').focus(), 50);
    }
    if (e.key.toLowerCase() === 'f') enterFocusMode();
    if (e.key === '?') document.getElementById('shortcuts-overlay').classList.remove('hidden');
  });
}

// =============================================
// HELPERS
// =============================================
function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// =============================================
// EVENT WIRING
// =============================================
function wireEvents() {
  // Tasks
  document.getElementById('add-task-btn').addEventListener('click', () => {
    document.getElementById('add-task-form').classList.remove('hidden');
    document.getElementById('add-task-btn').classList.add('hidden');
    document.getElementById('new-task-name').focus();
  });
  document.getElementById('save-task-btn').addEventListener('click', addTask);
  document.getElementById('cancel-task-btn').addEventListener('click', () => {
    document.getElementById('add-task-form').classList.add('hidden');
    document.getElementById('add-task-btn').classList.remove('hidden');
  });
  document.getElementById('new-task-name').addEventListener('keydown', e => { if (e.key === 'Enter') addTask(); });
  document.getElementById('yesterday-toggle').addEventListener('click', () => {
    document.getElementById('yesterday-tasks').classList.toggle('hidden');
  });

  // Habits
  document.getElementById('add-habit-btn').addEventListener('click', () => {
    document.getElementById('add-habit-form').classList.remove('hidden');
    document.getElementById('new-habit-name').focus();
  });
  document.getElementById('save-habit-btn').addEventListener('click', addHabit);
  document.getElementById('cancel-habit-btn').addEventListener('click', () => {
    document.getElementById('add-habit-form').classList.add('hidden');
  });
  document.getElementById('new-habit-name').addEventListener('keydown', e => { if (e.key === 'Enter') addHabit(); });

  // Level up
  document.getElementById('levelup-confirm-btn').addEventListener('click', () => {
    if (pendingLevelUpIdx === null) return;
    const habits = load(KEYS.habits) || [];
    const newName = document.getElementById('levelup-new-name').value.trim();
    if (newName) {
      habits[pendingLevelUpIdx].levelHistory = habits[pendingLevelUpIdx].levelHistory || [];
      habits[pendingLevelUpIdx].levelHistory.push({ from: habits[pendingLevelUpIdx].name, date: today() });
      habits[pendingLevelUpIdx].name = newName;
    }
    save(KEYS.habits, habits);
    document.getElementById('levelup-modal').classList.add('hidden');
    renderHabits();
  });
  document.getElementById('levelup-dismiss-btn').addEventListener('click', () => {
    document.getElementById('levelup-modal').classList.add('hidden');
  });

  // Monthly goals
  document.getElementById('add-monthly-btn').addEventListener('click', () => {
    document.getElementById('add-monthly-form').classList.remove('hidden');
    document.getElementById('new-monthly-title').focus();
  });
  document.getElementById('save-monthly-btn').addEventListener('click', addMonthlyGoal);
  document.getElementById('cancel-monthly-btn').addEventListener('click', () => {
    document.getElementById('add-monthly-form').classList.add('hidden');
  });

  // Training
  document.getElementById('start-workout-btn').addEventListener('click', startWorkout);
  document.getElementById('finish-workout-btn').addEventListener('click', finishWorkout);
  document.getElementById('add-exercise-btn').addEventListener('click', () => {
    document.getElementById('exercise-modal').classList.remove('hidden');
  });
  document.getElementById('save-exercise-btn').addEventListener('click', addExercise);
  document.getElementById('close-exercise-btn').addEventListener('click', () => {
    document.getElementById('exercise-modal').classList.add('hidden');
  });
  document.getElementById('rm-calc-btn').addEventListener('click', calcRM);
  document.getElementById('edit-split-btn').addEventListener('click', openSplitEditor);
  document.getElementById('save-split-btn').addEventListener('click', saveSplit);
  document.getElementById('close-split-btn').addEventListener('click', () => {
    document.getElementById('split-modal').classList.add('hidden');
  });

  // Nutrition
  document.getElementById('add-meal-btn').addEventListener('click', () => {
    document.getElementById('meal-modal').classList.remove('hidden');
  });
  document.getElementById('save-meal-btn').addEventListener('click', () => {
    const name = document.getElementById('meal-name').value.trim();
    if (!name) return;
    addMeal({
      name, group: document.getElementById('meal-group-sel').value,
      calories: parseInt(document.getElementById('meal-cal').value) || 0,
      protein: parseFloat(document.getElementById('meal-pro').value) || 0,
      carbs: parseFloat(document.getElementById('meal-carb').value) || 0,
      fat: parseFloat(document.getElementById('meal-fat-in').value) || 0,
    });
    ['meal-name','meal-cal','meal-pro','meal-carb','meal-fat-in'].forEach(id => { document.getElementById(id).value = ''; });
    document.getElementById('meal-modal').classList.add('hidden');
  });
  document.getElementById('close-meal-btn').addEventListener('click', () => {
    document.getElementById('meal-modal').classList.add('hidden');
  });
  document.getElementById('add-preset-btn').addEventListener('click', () => {
    document.getElementById('preset-modal').classList.remove('hidden');
  });
  document.getElementById('save-preset-btn').addEventListener('click', () => {
    const name = document.getElementById('preset-name').value.trim();
    if (!name) return;
    const ps = load(KEYS.presets) || [];
    ps.push({
      name, group: document.getElementById('preset-group-sel').value,
      calories: parseInt(document.getElementById('preset-cal').value) || 0,
      protein: parseFloat(document.getElementById('preset-pro').value) || 0,
      carbs: parseFloat(document.getElementById('preset-carb').value) || 0,
      fat: parseFloat(document.getElementById('preset-fat-in').value) || 0,
    });
    save(KEYS.presets, ps);
    document.getElementById('preset-modal').classList.add('hidden');
    renderPresets();
  });
  document.getElementById('close-preset-btn').addEventListener('click', () => {
    document.getElementById('preset-modal').classList.add('hidden');
  });
  document.getElementById('add-water-btn').addEventListener('click', () => {
    const all = load(KEYS.water) || {};
    all[today()] = (all[today()] || 0) + 1;
    save(KEYS.water, all);
    renderWater();
  });
  document.getElementById('gen-week-btn').addEventListener('click', () => {
    const presets = load(KEYS.presets) || [];
    if (!presets.length) return;
    const days = ['MON','TUE','WED','THU','FRI','SAT','SUN'];
    const rows = ['Breakfast','Lunch','Dinner'];
    const mp = {};
    days.forEach(d => {
      mp[d] = {};
      rows.forEach(r => {
        const p = presets[Math.floor(Math.random()*presets.length)];
        mp[d][r] = p.name;
      });
    });
    save(KEYS.mealPlan, mp);
    renderMealPlanner();
  });

  // Recovery
  document.getElementById('log-sleep-btn').addEventListener('click', logSleep);
  document.getElementById('log-whoop-btn').addEventListener('click', logWhoop);
  document.getElementById('log-steps-btn').addEventListener('click', logSteps);
  document.getElementById('steps-input').addEventListener('keydown', e => { if (e.key === 'Enter') logSteps(); });
  document.getElementById('log-mindset-btn').addEventListener('click', logMindset);

  // Settings
  document.getElementById('settings-btn').addEventListener('click', openSettings);
  document.getElementById('save-settings-btn').addEventListener('click', saveSettings);
  document.getElementById('close-settings-btn').addEventListener('click', () => {
    document.getElementById('settings-modal').classList.add('hidden');
  });
  document.querySelectorAll('.swatch').forEach(sw => {
    sw.addEventListener('click', () => {
      document.querySelectorAll('.swatch').forEach(s => s.classList.remove('active'));
      sw.classList.add('active');
    });
  });
  document.getElementById('export-data-btn').addEventListener('click', exportData);
  document.getElementById('import-data-btn').addEventListener('click', () => {
    document.getElementById('import-file').click();
  });
  document.getElementById('import-file').addEventListener('change', e => {
    if (e.target.files[0]) importData(e.target.files[0]);
  });
  document.getElementById('clear-data-btn').addEventListener('click', () => {
    if (confirm('Clear ALL data? This cannot be undone.')) {
      Object.values(KEYS).forEach(k => localStorage.removeItem(k));
      location.reload();
    }
  });

  // Focus
  document.getElementById('exit-focus-btn').addEventListener('click', exitFocusMode);
  document.getElementById('focus-start-btn').addEventListener('click', startFocusTimer);
  document.getElementById('focus-reset-btn').addEventListener('click', resetFocusTimer);

  // Morning brief dismiss
  document.getElementById('mb-dismiss').addEventListener('click', () => {
    document.getElementById('morning-modal').classList.add('hidden');
  });

  // Shortcuts
  document.getElementById('close-shortcuts-btn').addEventListener('click', () => {
    document.getElementById('shortcuts-overlay').classList.add('hidden');
  });

  // Weight log
  document.getElementById('log-weight-btn').addEventListener('click', () => {
    const w = parseFloat(document.getElementById('weight-input').value);
    if (!w) return;
    const all = load(KEYS.weight) || {};
    all[today()] = w;
    save(KEYS.weight, all);
    document.getElementById('weight-input').value = '';
    renderWeightChart();
  });

  // Weekly review
  document.getElementById('save-weekly-review-btn').addEventListener('click', saveWeeklyReview);

  // Modal overlay click-outside
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => {
      if (e.target === overlay) overlay.classList.add('hidden');
    });
  });
}

// =============================================
// INIT
// =============================================
function init() {
  const s = getSettings();
  // Force JARVIS blue — override any previously saved accent
  const accent = '#00d4ff';
  applyTheme(accent);
  if (s.compact) document.body.classList.add('compact');

  checkMidnightReset();
  startClock();
  initTabs();
  initSubnavs();
  initKeyboard();
  wireEvents();
  wireFbaEvents();

  // Render all sections
  renderTasks();
  renderHabits();
  renderMonthlyGoals();
  updateStreakPanel();
  renderWeekSched();
  renderTodayWorkout();
  renderExerciseLibrary();
  renderMacroRings();
  renderMealLog();
  renderPresets();
  renderMealPlanner();
  renderSleepChart();
  renderStepsSection();
  renderCompositeScore();
  renderMoodStars();
  renderFbaBuyList();
  renderFbaContacts();
  renderStorefronts();
  renderPipeline();
  renderFbaKpis();

  // Load Whoop data for today
  const wData = (load(KEYS.whoop)||{})[today()];
  if (wData) renderWhoopGauge(wData.recovery);
  else renderWhoopGauge(0);

  // Modals
  setTimeout(() => {
    checkMorningBrief();
    checkWeeklyReview();
  }, 800);

  // Merge scraped contacts from contacts-live.js into localStorage on startup
  mergeLiveContacts();

  // Periodic refresh
  setInterval(() => {
    updateStatsBar();
    updateStreakPanel();
  }, 60000);

  // Poll contacts-live.js every 30s for new brands added by the scraper
  startLiveContactsPolling();
}

function mergeLiveContacts() {
  const live = window.SCRAPED_CONTACTS;
  if (!live || !live.length) return;
  const existing = load(KEYS.fbaContacts) || [];
  const existingNames = new Set(existing.map(c => (c.brand || '').toLowerCase()));
  let added = 0;
  for (const c of live) {
    if (!c.brand || existingNames.has(c.brand.toLowerCase())) continue;
    existing.push(c);
    existingNames.add(c.brand.toLowerCase());
    added++;
  }
  if (added > 0) {
    save(KEYS.fbaContacts, existing);
    renderFbaContacts();
    renderPipeline();
    renderFbaKpis();
  }
}

function startLiveContactsPolling() {
  setInterval(() => {
    const s = document.createElement('script');
    s.src = 'contacts-live.js?' + Date.now();
    s.onload = () => { mergeLiveContacts(); s.remove(); };
    s.onerror = () => s.remove();
    document.head.appendChild(s);
  }, 30000);
}

document.addEventListener('DOMContentLoaded', init);
