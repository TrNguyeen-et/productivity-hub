// Productivity Hub - Multi-User (Sun & Icarus) & Resilient iPad Timer Engine
let activeUser = localStorage.getItem('ph_active_user') || ''; // 'sun' or 'icarus'

function getUserKey(base) {
  return `ph_${activeUser || 'default'}_${base}`;
}

let state = {
  apiUrl: '',
  todos: [],
  notes: [],
  studyLogs: [],
  goals: [],
  schedule: []
};

function saveToStorage(baseKey, data) {
  localStorage.setItem(getUserKey(baseKey), JSON.stringify(data));
}

// Monochrome SVG Icons for P1 (Girl) and P2 (Boy)
const ICON_GIRL_SVG = `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"/><path d="M15 7.5c1.5-1.5 3.5-.5 3.5 2 0 3-2 5-4.5 5.5"/><path d="M4 21v-2a5 5 0 0 1 10 0v2"/></svg>`;
const ICON_BOY_SVG = `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="7" r="4"/><path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/><path d="M9 4.5c1-1 3-1 4 0"/></svg>`;

function loadUserData(user) {
  activeUser = user;
  localStorage.setItem('ph_active_user', user);

  const isSun = user === 'sun';
  const iconSvg = isSun ? ICON_GIRL_SVG : ICON_BOY_SVG;

  // Update header label & icon
  const label = document.getElementById('currentUserLabel');
  if (label) {
    label.innerText = isSun ? 'Sun (P1)' : 'Icarus (P2)';
  }

  const iconSpan = document.getElementById('currentUserIcon');
  if (iconSpan) {
    iconSpan.innerHTML = iconSvg;
  }

  const avatar = document.querySelector('.user-avatar');
  if (avatar) {
    avatar.innerHTML = iconSvg;
  }

  // Hide welcome portal
  const portal = document.getElementById('welcomePortal');
  if (portal) {
    portal.classList.add('hidden-portal');
  }

  // Load state for this user
  state.apiUrl = localStorage.getItem(getUserKey('api_url')) || localStorage.getItem('ph_shared_api_url') || '';
  state.todos = JSON.parse(localStorage.getItem(getUserKey('todos')) || '[]');
  state.notes = JSON.parse(localStorage.getItem(getUserKey('notes')) || '[]');
  state.studyLogs = JSON.parse(localStorage.getItem(getUserKey('study_logs')) || '[]');
  state.goals = JSON.parse(localStorage.getItem(getUserKey('goals')) || '[]');
  state.schedule = JSON.parse(localStorage.getItem(getUserKey('schedule')) || '[]');

  seedDemoData();
  renderAll();

  if (state.apiUrl) {
    updateSyncUI('synced', 'Đã đồng bộ');
  } else {
    updateSyncUI('idle', 'Cục bộ (Chưa nối Sheet)');
  }
}

function showWelcomePortal() {
  const portal = document.getElementById('welcomePortal');
  if (portal) {
    portal.classList.remove('hidden-portal');
    switchGatewayMode('light'); // Nền trắng là mặc định
  }
}

// Seed Demo Data per user
function seedDemoData() {
  if (state.goals.length === 0) {
    state.goals = activeUser === 'sun' ? [
      { id: 'g1', title: 'Hoàn thành 30 giờ tự học tháng này', target: 30, achieved: 14, unit: 'giờ' },
      { id: 'g2', title: 'Hoàn thành 50 bài tập Todo', target: 50, achieved: 32, unit: 'việc' }
    ] : [
      { id: 'g1', title: 'Mục tiêu bay cao: 40 giờ tự học', target: 40, achieved: 18, unit: 'giờ' },
      { id: 'g2', title: 'Nhiệm vụ Icarus: 60 bài tập', target: 60, achieved: 25, unit: 'việc' }
    ];
    saveToStorage('goals', state.goals);
  }
  if (state.schedule.length === 0) {
    state.schedule = [
      { id: 's1', day: 'Thứ 2', start_time: '08:00', end_time: '11:00', activity: 'Lập trình & Kỹ năng số', type: 'Học' },
      { id: 's2', day: 'Thứ 2', start_time: '14:00', end_time: '16:30', activity: 'Đọc sách & Thư giãn', type: 'Rảnh' },
      { id: 's3', day: 'Thứ 4', start_time: '19:30', end_time: '21:30', activity: 'Tiếng Anh giao tiếp', type: 'Học' }
    ];
    saveToStorage('schedule', state.schedule);
  }
  if (state.studyLogs.length === 0) {
    const today = new Date();
    const demoOffsets = [0, 1, 2, 4, 6, 8, 10, 13, 15, 20, 22, 25];
    demoOffsets.forEach(offset => {
      const d = new Date(today);
      d.setDate(d.getDate() - offset);
      state.studyLogs.push({
        id: 'lg_demo_' + offset,
        subject: offset % 2 === 0 ? 'Toán học' : 'Lập trình',
        duration_minutes: 45 + (offset * 15) % 90,
        date: d.toISOString().split('T')[0],
        notes: ''
      });
    });
    saveToStorage('study_logs', state.studyLogs);
  }
}

// -------------------------------------------------------------
// SYNC ENGINE (OPTIMISTIC UI - BACKGROUND NON-BLOCKING)
// -------------------------------------------------------------
const syncBadge = document.getElementById('syncBadge');
const syncText = document.getElementById('syncText');

function updateSyncUI(status, message) {
  if (!syncBadge || !syncText) return;
  syncBadge.className = `sync-pill-badge ${status}`;
  syncText.innerText = message;
}

async function sendToSheet(action, sheet, payload) {
  if (!state.apiUrl) return;

  updateSyncUI('syncing', 'Đang lưu lên Sheet...');
  try {
    await fetch(state.apiUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, sheet, user: activeUser, ...payload })
    });
    updateSyncUI('synced', 'Đã đồng bộ');
  } catch (err) {
    console.warn('Lỗi đồng bộ ngầm:', err);
    updateSyncUI('error', 'Chờ đồng bộ lại');
  }
}

async function fetchAllFromSheet() {
  if (!state.apiUrl) {
    alert('Vui lòng nhập link Web App URL trong mục Cài đặt trước!');
    return;
  }
  updateSyncUI('syncing', 'Đang tải từ Sheet...');
  try {
    const res = await fetch(state.apiUrl);
    const json = await res.json();
    if (json.status === 'success' && json.data) {
      if (json.data.Todos) {
        state.todos = json.data.Todos.filter(t => !t.user || t.user === activeUser);
        saveToStorage('todos', state.todos);
      }
      if (json.data.Notes) {
        state.notes = json.data.Notes.filter(n => !n.user || n.user === activeUser);
        saveToStorage('notes', state.notes);
      }
      if (json.data.StudyLogs) {
        state.studyLogs = json.data.StudyLogs.filter(l => !l.user || l.user === activeUser);
        saveToStorage('study_logs', state.studyLogs);
      }
      if (json.data.Schedule) {
        state.schedule = json.data.Schedule.filter(s => !s.user || s.user === activeUser);
        saveToStorage('schedule', state.schedule);
      }
      if (json.data.Goals) {
        state.goals = json.data.Goals.filter(g => !g.user || g.user === activeUser);
        saveToStorage('goals', state.goals);
      }
      renderAll();
      updateSyncUI('synced', 'Đã đồng bộ');
      alert(`Đồng bộ từ Google Sheets thành công cho ${activeUser === 'sun' ? 'Sun' : 'Icarus'}!`);
    }
  } catch (err) {
    console.error(err);
    updateSyncUI('error', 'Lỗi kết nối Sheet');
  }
}

// -------------------------------------------------------------
// NAVIGATION
// -------------------------------------------------------------
function switchTab(tabId) {
  document.querySelectorAll('.nav-item').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tabId);
  });
  document.querySelectorAll('.tab-pane').forEach(p => {
    p.classList.toggle('active', p.id === `tab-${tabId}`);
  });
}

document.querySelectorAll('.nav-item[data-tab]').forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

document.getElementById('btnQuickAdd').addEventListener('click', () => {
  switchTab('todo');
  document.getElementById('todoInput').focus();
});

document.getElementById('btnStartQuickStudy').addEventListener('click', () => {
  switchTab('timer');
  document.getElementById('btnTimerToggle').click();
});

// -------------------------------------------------------------
// MODULE 1: DASHBOARD & GITHUB-STYLE ACTIVITY HEATMAP
// -------------------------------------------------------------
function renderDashboard() {
  const todayStr = new Date().toISOString().split('T')[0];

  // 1. Study Hours KPI
  const todayMinutes = state.studyLogs
    .filter(log => log.date === todayStr)
    .reduce((sum, item) => sum + Number(item.duration_minutes || 0), 0);
  
  const studyHours = (todayMinutes / 60).toFixed(1);
  document.getElementById('statStudyHours').innerText = studyHours;
  
  const targetStudyHours = 5.0;
  const activeStudySegments = Math.min(8, Math.round((parseFloat(studyHours) / targetStudyHours) * 8));
  const studyPct = Math.min(100, Math.round((parseFloat(studyHours) / targetStudyHours) * 100));
  document.getElementById('kpiStudyPercent').innerText = `${studyPct}%`;
  
  const studyCapsules = document.querySelectorAll('#studyCapsuleBar .capsule-fill');
  studyCapsules.forEach((cap, idx) => {
    cap.classList.toggle('active', idx < activeStudySegments);
  });

  // 2. Todo KPI
  const totalTodos = state.todos.length;
  const doneTodos = state.todos.filter(t => t.status === 'done').length;
  document.getElementById('statTodoRatio').innerText = doneTodos;
  document.getElementById('statTodoTotal').innerHTML = `&nbsp;/ ${totalTodos} việc`;
  
  const todoPct = totalTodos > 0 ? Math.round((doneTodos / totalTodos) * 100) : 0;
  document.getElementById('kpiTodoPercent').innerText = `${todoPct}%`;
  
  const activeTodoSegments = totalTodos > 0 ? Math.min(8, Math.round((doneTodos / totalTodos) * 8)) : 0;
  const todoCapsules = document.querySelectorAll('#todoCapsuleBar .capsule-fill');
  todoCapsules.forEach((cap, idx) => {
    cap.classList.toggle('active', idx < activeTodoSegments);
  });

  renderGithubHeatmap();
  renderWeeklyCapsuleChart();
  renderGoalsList();
}

function renderGithubHeatmap() {
  const container = document.getElementById('githubHeatmap');
  if (!container) return;
  container.innerHTML = '';

  const totalWeeks = 20;
  const totalDays = totalWeeks * 7;
  const today = new Date();
  
  const activityMap = {};
  let totalStudyMinutes = 0;
  
  state.studyLogs.forEach(log => {
    if (!log.date) return;
    const mins = Number(log.duration_minutes || 0);
    totalStudyMinutes += mins;
    activityMap[log.date] = (activityMap[log.date] || 0) + mins;
  });

  state.todos.forEach(todo => {
    if (todo.status === 'done') {
      const d = todo.created_at || today.toISOString().split('T')[0];
      activityMap[d] = (activityMap[d] || 0) + 25;
    }
  });

  const startDate = new Date(today);
  startDate.setDate(today.getDate() - totalDays + (7 - today.getDay()));

  let completedTasksCount = state.todos.filter(t => t.status === 'done').length;
  document.getElementById('heatmapStatsSummary').innerText = 
    `Tổng cộng: ${(totalStudyMinutes / 60).toFixed(1)} giờ học & ${completedTasksCount} việc đã xong`;

  for (let i = 0; i < totalDays; i++) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    const dateStr = d.toISOString().split('T')[0];
    const score = activityMap[dateStr] || 0;

    let lvl = 'lvl-0';
    if (score > 120) lvl = 'lvl-4';
    else if (score > 60) lvl = 'lvl-3';
    else if (score > 25) lvl = 'lvl-2';
    else if (score > 0) lvl = 'lvl-1';

    const cell = document.createElement('div');
    cell.className = `heatmap-cell ${lvl}`;
    const displayDate = d.toLocaleDateString('vi-VN');
    cell.title = `${displayDate}: ${score > 0 ? `${score} phút hoạt động` : 'Chưa có hoạt động'}`;
    container.appendChild(cell);
  }
}

function renderWeeklyCapsuleChart() {
  const container = document.getElementById('weeklyCapsuleChart');
  if (!container) return;
  container.innerHTML = '';

  const days = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
  days.forEach((day, idx) => {
    const darkPct = [65, 40, 85, 20, 75, 45, 60][idx];
    const limePct = [25, 20, 15, 10, 20, 30, 25][idx];

    const col = document.createElement('div');
    col.className = 'dual-bar-col';
    col.innerHTML = `
      <div class="dual-capsule-track">
        <div class="capsule-segment-dark" style="height: ${darkPct}%;"></div>
        <div class="capsule-segment-lime" style="height: ${limePct}%;"></div>
      </div>
      <span class="day-label">${day}</span>
    `;
    container.appendChild(col);
  });
}

function renderGoalsList() {
  const container = document.getElementById('goalsList');
  if (!container) return;
  container.innerHTML = '';

  state.goals.forEach(goal => {
    const pct = Math.min(100, Math.round((goal.achieved / goal.target) * 100));
    const item = document.createElement('div');
    item.className = 'goal-item';
    item.innerHTML = `
      <div class="goal-info">
        <span>${escapeHtml(goal.title)}</span>
        <span>${goal.achieved}/${goal.target} ${goal.unit} (${pct}%)</span>
      </div>
      <div class="progress-track">
        <div class="progress-fill" style="width: ${pct}%"></div>
      </div>
    `;
    container.appendChild(item);
  });
}

// -------------------------------------------------------------
// MODULE 2: TODO LIST
// -------------------------------------------------------------
let currentTodoFilter = 'all';

function renderTodos() {
  const list = document.getElementById('todoList');
  if (!list) return;
  list.innerHTML = '';

  const filtered = state.todos.filter(item => {
    if (currentTodoFilter === 'pending') return item.status !== 'done';
    if (currentTodoFilter === 'done') return item.status === 'done';
    return true;
  });

  filtered.forEach(todo => {
    const li = document.createElement('li');
    li.className = `stylish-todo-item ${todo.status === 'done' ? 'done' : ''}`;
    const prioClass = `prio-${(todo.priority || 'Bình-thường').replace(/\s+/g, '-')}`;

    li.innerHTML = `
      <div class="todo-left-box">
        <input type="checkbox" ${todo.status === 'done' ? 'checked' : ''} data-id="${todo.id}">
        <span>${escapeHtml(todo.task)}</span>
        <span class="badge-tag-prio ${prioClass}">${todo.priority || 'Bình thường'}</span>
      </div>
      <button class="btn-trash" data-id="${todo.id}">🗑️</button>
    `;
    list.appendChild(li);
  });

  renderDashboard();
}

function addTodo() {
  const input = document.getElementById('todoInput');
  const task = input.value.trim();
  if (!task) return;

  const priority = document.getElementById('todoPriority').value;
  const newTodo = {
    id: 'td_' + Date.now(),
    user: activeUser,
    task,
    status: 'pending',
    priority,
    created_at: new Date().toLocaleDateString('vi-VN')
  };

  state.todos.unshift(newTodo);
  saveToStorage('todos', state.todos);
  input.value = '';
  renderTodos();

  sendToSheet('append', 'Todos', { data: newTodo });
}

document.getElementById('btnAddTodo').addEventListener('click', addTodo);
document.getElementById('todoInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') addTodo();
});

document.getElementById('todoList').addEventListener('click', (e) => {
  const id = e.target.dataset.id;
  if (!id) return;

  if (e.target.type === 'checkbox') {
    const item = state.todos.find(t => t.id === id);
    if (item) {
      item.status = e.target.checked ? 'done' : 'pending';
      saveToStorage('todos', state.todos);
      renderTodos();
      sendToSheet('update_status', 'Todos', { id, status: item.status });
    }
  } else if (e.target.classList.contains('btn-trash')) {
    state.todos = state.todos.filter(t => t.id !== id);
    saveToStorage('todos', state.todos);
    renderTodos();
    sendToSheet('delete', 'Todos', { id });
  }
});

document.querySelectorAll('.filter-pill').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-pill').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentTodoFilter = btn.dataset.filter;
    renderTodos();
  });
});

// -------------------------------------------------------------
// MODULE 3: QUICK NOTES
// -------------------------------------------------------------
const noteForm = document.getElementById('noteForm');
document.getElementById('btnNewNote').addEventListener('click', () => {
  noteForm.classList.remove('hidden');
  document.getElementById('noteTitle').focus();
});
document.getElementById('btnCancelNote').addEventListener('click', () => {
  noteForm.classList.add('hidden');
});

document.getElementById('btnSaveNote').addEventListener('click', () => {
  const title = document.getElementById('noteTitle').value.trim();
  const content = document.getElementById('noteContent').value.trim();
  if (!title && !content) return;

  const newNote = {
    id: 'nt_' + Date.now(),
    user: activeUser,
    title: title || 'Ghi chú',
    content,
    updated_at: new Date().toLocaleDateString('vi-VN')
  };

  state.notes.unshift(newNote);
  saveToStorage('notes', state.notes);
  document.getElementById('noteTitle').value = '';
  document.getElementById('noteContent').value = '';
  noteForm.classList.add('hidden');
  renderNotes();

  sendToSheet('append', 'Notes', { data: newNote });
});

function renderNotes() {
  const grid = document.getElementById('notesGrid');
  if (!grid) return;
  grid.innerHTML = '';

  state.notes.forEach(note => {
    const card = document.createElement('div');
    card.className = 'note-box';
    card.innerHTML = `
      <div>
        <h3>${escapeHtml(note.title)}</h3>
        <p>${escapeHtml(note.content)}</p>
      </div>
      <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.75rem; color: #a1a1aa;">
        <span>${note.updated_at || ''}</span>
        <button class="btn-trash" data-id="${note.id}">🗑️</button>
      </div>
    `;
    grid.appendChild(card);
  });
}

document.getElementById('notesGrid').addEventListener('click', (e) => {
  const id = e.target.dataset.id;
  if (!id) return;
  if (confirm('Xóa ghi chú này?')) {
    state.notes = state.notes.filter(n => n.id !== id);
    saveToStorage('notes', state.notes);
    renderNotes();
    sendToSheet('delete', 'Notes', { id });
  }
});

// -------------------------------------------------------------
// MODULE 4: STUDY TIMER & LOGS (RESILIENT TIMESTAMP ENGINE - NEVER FREEZES ON IPAD)
// -------------------------------------------------------------
let timerInterval = null;
let timerRunning = false;
let timerSeconds = 25 * 60;
let timerTargetTimestamp = null;
let timerStartTimestamp = null;
let timerMode = 'pomodoro'; // 'pomodoro', 'short-break', or 'stopwatch'

const timerDisplay = document.getElementById('timerDisplay');
const btnTimerToggle = document.getElementById('btnTimerToggle');
const btnTimerReset = document.getElementById('btnTimerReset');

function updateTimerDisplay() {
  const mins = Math.floor(timerSeconds / 60);
  const secs = timerSeconds % 60;
  timerDisplay.innerText = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function tickTimer() {
  const now = Date.now();
  if (timerMode === 'pomodoro' || timerMode === 'short-break') {
    timerSeconds = Math.max(0, Math.round((timerTargetTimestamp - now) / 1000));
    updateTimerDisplay();
    if (timerSeconds <= 0) {
      clearInterval(timerInterval);
      timerRunning = false;
      alert('🔔 Hết giờ phiên học/nghỉ ngơi!');
      btnTimerToggle.innerText = 'Bắt đầu học';
    }
  } else {
    // Stopwatch
    timerSeconds = Math.max(0, Math.round((now - timerStartTimestamp) / 1000));
    updateTimerDisplay();
  }
}

btnTimerToggle.addEventListener('click', () => {
  if (timerRunning) {
    // Pause
    clearInterval(timerInterval);
    timerRunning = false;
    btnTimerToggle.innerText = 'Tiếp tục học';
  } else {
    // Start with absolute timestamp
    timerRunning = true;
    btnTimerToggle.innerText = 'Tạm dừng';
    const now = Date.now();
    if (timerMode === 'pomodoro' || timerMode === 'short-break') {
      timerTargetTimestamp = now + timerSeconds * 1000;
    } else {
      timerStartTimestamp = now - timerSeconds * 1000;
    }
    timerInterval = setInterval(tickTimer, 1000);
  }
});

btnTimerReset.addEventListener('click', () => {
  clearInterval(timerInterval);
  timerRunning = false;
  timerSeconds = timerMode === 'pomodoro' ? 25 * 60 : (timerMode === 'short-break' ? 5 * 60 : 0);
  btnTimerToggle.innerText = 'Bắt đầu học';
  updateTimerDisplay();
});

document.querySelectorAll('.mode-pill').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.mode-pill').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    timerMode = btn.dataset.mode;
    clearInterval(timerInterval);
    timerRunning = false;
    timerSeconds = timerMode === 'pomodoro' ? 25 * 60 : (timerMode === 'short-break' ? 5 * 60 : 0);
    btnTimerToggle.innerText = 'Bắt đầu học';
    updateTimerDisplay();
  });
});

// Resilient iPad Handler: Never freezes when tab is in background or iPad screen locked!
document.addEventListener('visibilitychange', () => {
  if (timerRunning) {
    tickTimer();
  }
});
window.addEventListener('focus', () => {
  if (timerRunning) {
    tickTimer();
  }
});

document.getElementById('btnSaveLog').addEventListener('click', () => {
  const subject = document.getElementById('logSubject').value.trim() || 'Tự học';
  const minutes = parseInt(document.getElementById('logMinutes').value, 10);
  if (!minutes || minutes <= 0) {
    alert('Vui lòng nhập số phút đã học!');
    return;
  }

  const newLog = {
    id: 'lg_' + Date.now(),
    user: activeUser,
    subject,
    duration_minutes: minutes,
    date: new Date().toISOString().split('T')[0],
    notes: ''
  };

  state.studyLogs.unshift(newLog);
  saveToStorage('study_logs', state.studyLogs);
  document.getElementById('logSubject').value = '';
  document.getElementById('logMinutes').value = '';
  renderStudyLogs();
  renderDashboard();

  sendToSheet('append', 'StudyLogs', { data: newLog });
});

function renderStudyLogs() {
  const container = document.getElementById('studyLogsList');
  if (!container) return;
  container.innerHTML = '';
  state.studyLogs.slice(0, 8).forEach(log => {
    const item = document.createElement('div');
    item.className = 'study-log-item';
    item.innerHTML = `
      <span><strong>${escapeHtml(log.subject)}</strong> &nbsp;·&nbsp; ${log.duration_minutes} phút</span>
      <span class="log-date">${log.date}</span>
    `;
    container.appendChild(item);
  });
}

// -------------------------------------------------------------
// MODULE 5: SCHEDULE
// -------------------------------------------------------------
const scheduleForm = document.getElementById('scheduleForm');
document.getElementById('btnAddSchedule').addEventListener('click', () => {
  scheduleForm.classList.remove('hidden');
});
document.getElementById('btnCancelSchedule').addEventListener('click', () => {
  scheduleForm.classList.add('hidden');
});

document.getElementById('btnSaveSchedule').addEventListener('click', () => {
  const day = document.getElementById('schedDay').value;
  const start_time = document.getElementById('schedStart').value;
  const end_time = document.getElementById('schedEnd').value;
  const type = document.getElementById('schedType').value;
  const activity = document.getElementById('schedActivity').value.trim() || (type === 'Học' ? 'Buổi học' : 'Thời gian rảnh');

  const newSlot = {
    id: 'sc_' + Date.now(),
    user: activeUser,
    day,
    start_time,
    end_time,
    activity,
    type
  };

  state.schedule.push(newSlot);
  saveToStorage('schedule', state.schedule);
  scheduleForm.classList.add('hidden');
  renderSchedule();

  sendToSheet('append', 'Schedule', { data: newSlot });
});

function renderSchedule() {
  const days = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];
  days.forEach(day => {
    const col = document.querySelector(`.day-slot-card[data-day="${day}"] .day-slots`);
    if (!col) return;
    col.innerHTML = '';
    const slots = state.schedule.filter(s => s.day === day);
    slots.sort((a, b) => a.start_time.localeCompare(b.start_time));

    slots.forEach(slot => {
      const div = document.createElement('div');
      div.className = `sched-slot type-${slot.type}`;
      div.innerHTML = `
        <div style="font-weight: 700; font-size: 0.75rem;">${slot.start_time} - ${slot.end_time}</div>
        <div>${escapeHtml(slot.activity)}</div>
      `;
      col.appendChild(div);
    });
  });
}

// -------------------------------------------------------------
// SETTINGS MODAL
// -------------------------------------------------------------
const settingsModal = document.getElementById('settingsModal');
const inputApiUrl = document.getElementById('inputApiUrl');

function openSettings() {
  inputApiUrl.value = state.apiUrl;
  settingsModal.classList.remove('hidden');
}

document.getElementById('btnSettings').addEventListener('click', openSettings);
document.getElementById('btnSettingsIcon').addEventListener('click', openSettings);
document.getElementById('btnCloseModal').addEventListener('click', () => {
  settingsModal.classList.add('hidden');
});

document.getElementById('btnSaveApiUrl').addEventListener('click', () => {
  state.apiUrl = inputApiUrl.value.trim();
  localStorage.setItem(getUserKey('api_url'), state.apiUrl);
  localStorage.setItem('ph_shared_api_url', state.apiUrl);
  if (state.apiUrl) {
    updateSyncUI('synced', 'Đã lưu URL Sheet');
  } else {
    updateSyncUI('idle', 'Cục bộ (Chưa nối Sheet)');
  }
  settingsModal.classList.add('hidden');
});

document.getElementById('btnSyncNow').addEventListener('click', () => {
  state.apiUrl = inputApiUrl.value.trim();
  localStorage.setItem(getUserKey('api_url'), state.apiUrl);
  fetchAllFromSheet();
});

// -------------------------------------------------------------
// DUAL-MODE ARTISTIC GATEWAY CONTROLLER
// -------------------------------------------------------------
const gatewayDarkView = document.getElementById('gatewayDarkView');
const gatewayLightView = document.getElementById('gatewayLightView');

function switchGatewayMode(mode) {
  if (mode === 'light') {
    if (gatewayDarkView) gatewayDarkView.classList.add('hidden');
    if (gatewayLightView) gatewayLightView.classList.remove('hidden');
  } else {
    if (gatewayLightView) gatewayLightView.classList.add('hidden');
    if (gatewayDarkView) gatewayDarkView.classList.remove('hidden');
  }
}

// 1. BLACK / DARK MODE INTERACTIONS:
// Bấm hình the_white_sun_obj_for_black.png -> Vào Sheets Người 1 (Sun)
const btnSunObj = document.getElementById('btnSunObj');
if (btnSunObj) {
  btnSunObj.addEventListener('click', () => loadUserData('sun'));
}

// Bấm hình icarus_obj_for_black.png -> Vào Sheets Người 2 (Icarus)
const btnIcarusDarkObj = document.getElementById('btnIcarusDarkObj');
if (btnIcarusDarkObj) {
  btnIcarusDarkObj.addEventListener('click', () => loadUserData('icarus'));
}

// Bấm chữ "close" trong "so close.... yet so far" -> Chuyển sang giao diện Sáng
const btnQuoteClose = document.getElementById('btnQuoteClose');
if (btnQuoteClose) {
  btnQuoteClose.addEventListener('click', () => switchGatewayMode('light'));
}

// 2. WHITE / LIGHT MODE INTERACTIONS:
// Bấm vào hình ảnh icarus_obj_for_white.png -> Đổi sang chế độ Tối (Black mode)
const btnIcarusWhiteImg = document.getElementById('btnIcarusWhiteImg');
if (btnIcarusWhiteImg) {
  btnIcarusWhiteImg.addEventListener('click', () => switchGatewayMode('dark'));
}

// Bấm chữ "love" trong "i love you like icarus love the sun..." -> Vào Sheets Người 1 (Sun)
const btnQuoteLove = document.getElementById('btnQuoteLove');
if (btnQuoteLove) {
  btnQuoteLove.addEventListener('click', () => loadUserData('sun'));
}

// Bấm chữ "icarus" trong "i love you like icarus love the sun..." -> Vào Sheets Người 2 (Icarus)
const btnQuoteIcarus = document.getElementById('btnQuoteIcarus');
if (btnQuoteIcarus) {
  btnQuoteIcarus.addEventListener('click', () => loadUserData('icarus'));
}

// Nút đổi người dùng trên thanh header -> Mở lại Gateway
const btnSwitchUserHeader = document.getElementById('btnSwitchUserHeader');
if (btnSwitchUserHeader) {
  btnSwitchUserHeader.addEventListener('click', showWelcomePortal);
}

// -------------------------------------------------------------
// DARK MODE CONTROLLER
// -------------------------------------------------------------
const THEME_KEY = 'ph_theme';
let currentTheme = localStorage.getItem(THEME_KEY) || 'light';

function applyTheme(theme) {
  currentTheme = theme;
  localStorage.setItem(THEME_KEY, theme);
  const isDark = theme === 'dark';
  document.body.classList.toggle('dark-mode', isDark);

  const textHeader = document.getElementById('themeTextHeader');
  if (textHeader) {
    textHeader.innerText = isDark ? '☀️ Sáng' : '🌙 Tối';
  }

  const iconSidebar = document.getElementById('themeIconSidebar');
  if (iconSidebar) {
    iconSidebar.innerHTML = isDark
      ? '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>'
      : '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>';
  }
}

function toggleTheme() {
  applyTheme(currentTheme === 'dark' ? 'light' : 'dark');
}

const btnThemeHeader = document.getElementById('btnThemeToggleHeader');
if (btnThemeHeader) btnThemeHeader.addEventListener('click', toggleTheme);

const btnThemeSidebar = document.getElementById('btnThemeToggleSidebar');
if (btnThemeSidebar) btnThemeSidebar.addEventListener('click', toggleTheme);

applyTheme(currentTheme);

// Helper Escape HTML
function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, m => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[m]));
}

function renderAll() {
  renderDashboard();
  renderTodos();
  renderNotes();
  renderStudyLogs();
  renderSchedule();
}

// Initial Boot: Check if active user exists
if (activeUser) {
  loadUserData(activeUser);
} else {
  showWelcomePortal();
}
