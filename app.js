// Productivity Hub - Design 2.0 & GitHub-Style Activity Tracker Engine
const STORAGE_KEYS = {
  API_URL: 'ph_api_url',
  TODOS: 'ph_todos',
  NOTES: 'ph_notes',
  STUDY_LOGS: 'ph_study_logs',
  GOALS: 'ph_goals',
  SCHEDULE: 'ph_schedule'
};

// State
let state = {
  apiUrl: localStorage.getItem(STORAGE_KEYS.API_URL) || '',
  todos: JSON.parse(localStorage.getItem(STORAGE_KEYS.TODOS) || '[]'),
  notes: JSON.parse(localStorage.getItem(STORAGE_KEYS.NOTES) || '[]'),
  studyLogs: JSON.parse(localStorage.getItem(STORAGE_KEYS.STUDY_LOGS) || '[]'),
  goals: JSON.parse(localStorage.getItem(STORAGE_KEYS.GOALS) || '[]'),
  schedule: JSON.parse(localStorage.getItem(STORAGE_KEYS.SCHEDULE) || '[]')
};

function saveToStorage(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
}

// Seed Demo data if empty
function seedDemoData() {
  if (state.goals.length === 0) {
    state.goals = [
      { id: 'g1', title: 'Hoàn thành 30 giờ tự học tháng này', target: 30, achieved: 12, unit: 'giờ' },
      { id: 'g2', title: 'Hoàn thành 50 bài tập Todo', target: 50, achieved: 28, unit: 'việc' }
    ];
    saveToStorage(STORAGE_KEYS.GOALS, state.goals);
  }
  if (state.schedule.length === 0) {
    state.schedule = [
      { id: 's1', day: 'Thứ 2', start_time: '08:00', end_time: '11:00', activity: 'Lập trình Web & Git', type: 'Học' },
      { id: 's2', day: 'Thứ 2', start_time: '14:00', end_time: '16:30', activity: 'Đọc sách / Nghỉ ngơi', type: 'Rảnh' },
      { id: 's3', day: 'Thứ 4', start_time: '19:30', end_time: '21:30', activity: 'Tiếng Anh giao tiếp', type: 'Học' },
      { id: 's4', day: 'Thứ 6', start_time: '14:00', end_time: '17:00', activity: 'Toán cao cấp', type: 'Học' }
    ];
    saveToStorage(STORAGE_KEYS.SCHEDULE, state.schedule);
  }
  // Add some demo study logs across recent days to make heatmap beautiful
  if (state.studyLogs.length === 0) {
    const today = new Date();
    const demoOffsets = [0, 1, 2, 4, 6, 8, 10, 13, 15, 20, 22, 25];
    demoOffsets.forEach(offset => {
      const d = new Date(today);
      d.setDate(d.getDate() - offset);
      const dateStr = d.toISOString().split('T')[0];
      state.studyLogs.push({
        id: 'lg_demo_' + offset,
        subject: offset % 2 === 0 ? 'Toán học' : 'Lập trình',
        duration_minutes: 45 + (offset * 12) % 90,
        date: dateStr,
        notes: ''
      });
    });
    saveToStorage(STORAGE_KEYS.STUDY_LOGS, state.studyLogs);
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

if (!state.apiUrl) {
  updateSyncUI('idle', 'Cục bộ (Chưa nối Sheet)');
} else {
  updateSyncUI('synced', 'Đã đồng bộ');
}

async function sendToSheet(action, sheet, payload) {
  if (!state.apiUrl) return;

  updateSyncUI('syncing', 'Đang lưu lên Sheet...');
  try {
    await fetch(state.apiUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, sheet, ...payload })
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
      if (json.data.Todos && json.data.Todos.length) {
        state.todos = json.data.Todos;
        saveToStorage(STORAGE_KEYS.TODOS, state.todos);
      }
      if (json.data.Notes && json.data.Notes.length) {
        state.notes = json.data.Notes;
        saveToStorage(STORAGE_KEYS.NOTES, state.notes);
      }
      if (json.data.StudyLogs && json.data.StudyLogs.length) {
        state.studyLogs = json.data.StudyLogs;
        saveToStorage(STORAGE_KEYS.STUDY_LOGS, state.studyLogs);
      }
      if (json.data.Schedule && json.data.Schedule.length) {
        state.schedule = json.data.Schedule;
        saveToStorage(STORAGE_KEYS.SCHEDULE, state.schedule);
      }
      if (json.data.Goals && json.data.Goals.length) {
        state.goals = json.data.Goals;
        saveToStorage(STORAGE_KEYS.GOALS, state.goals);
      }
      renderAll();
      updateSyncUI('synced', 'Đã đồng bộ');
      alert('Đồng bộ từ Google Sheets thành công!');
    }
  } catch (err) {
    console.error(err);
    updateSyncUI('error', 'Lỗi kết nối Sheet');
  }
}

// -------------------------------------------------------------
// NAVIGATION (Both Sidebar and Top Pills)
// -------------------------------------------------------------
function switchTab(tabId) {
  document.querySelectorAll('.nav-item').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tabId);
  });
  document.querySelectorAll('.pill-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tabId);
  });
  document.querySelectorAll('.tab-pane').forEach(p => {
    p.classList.toggle('active', p.id === `tab-${tabId}`);
  });
}

document.querySelectorAll('.nav-item[data-tab]').forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

document.querySelectorAll('.pill-btn[data-tab]').forEach(btn => {
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
  
  // Capsule Segmented Fill (8 segments, target 5.0h)
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
  document.getElementById('statTodoTotal').innerText = `/ ${totalTodos} việc`;
  
  const todoPct = totalTodos > 0 ? Math.round((doneTodos / totalTodos) * 100) : 0;
  document.getElementById('kpiTodoPercent').innerText = `${todoPct}%`;
  
  const activeTodoSegments = totalTodos > 0 ? Math.min(8, Math.round((doneTodos / totalTodos) * 8)) : 0;
  const todoCapsules = document.querySelectorAll('#todoCapsuleBar .capsule-fill');
  todoCapsules.forEach((cap, idx) => {
    cap.classList.toggle('active', idx < activeTodoSegments);
  });

  // 3. Render GitHub Heatmap Tracker
  renderGithubHeatmap();

  // 4. Render Weekly Dual Capsule Chart
  renderWeeklyCapsuleChart();

  // 5. Goals List
  renderGoalsList();
}

// GitHub-Style Activity Heatmap Grid
function renderGithubHeatmap() {
  const container = document.getElementById('githubHeatmap');
  if (!container) return;
  container.innerHTML = '';

  // Generate last 20 weeks (140 days)
  const totalWeeks = 20;
  const totalDays = totalWeeks * 7;
  const today = new Date();
  
  // Calculate map of activity per date (study minutes + completed tasks)
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
      // Give each done task the weight of 25 mins activity
      const d = todo.created_at || today.toISOString().split('T')[0];
      activityMap[d] = (activityMap[d] || 0) + 25;
    }
  });

  // Start from Sunday of 20 weeks ago
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

    // Determine level 0 to 4
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

// Weekly Capsule Chart (Matching the reference design double capsule bars)
function renderWeeklyCapsuleChart() {
  const container = document.getElementById('weeklyCapsuleChart');
  if (!container) return;
  container.innerHTML = '';

  const days = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
  
  days.forEach((day, idx) => {
    // Generate realistic relative heights for demonstration
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
    task,
    status: 'pending',
    priority,
    created_at: new Date().toLocaleDateString('vi-VN')
  };

  state.todos.unshift(newTodo);
  saveToStorage(STORAGE_KEYS.TODOS, state.todos);
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
      saveToStorage(STORAGE_KEYS.TODOS, state.todos);
      renderTodos();
      sendToSheet('update_status', 'Todos', { id, status: item.status });
    }
  } else if (e.target.classList.contains('btn-trash')) {
    state.todos = state.todos.filter(t => t.id !== id);
    saveToStorage(STORAGE_KEYS.TODOS, state.todos);
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
    title: title || 'Ghi chú',
    content,
    updated_at: new Date().toLocaleDateString('vi-VN')
  };

  state.notes.unshift(newNote);
  saveToStorage(STORAGE_KEYS.NOTES, state.notes);
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
    saveToStorage(STORAGE_KEYS.NOTES, state.notes);
    renderNotes();
    sendToSheet('delete', 'Notes', { id });
  }
});

// -------------------------------------------------------------
// MODULE 4: STUDY TIMER & LOGS
// -------------------------------------------------------------
let timerInterval = null;
let timerSeconds = 25 * 60;
let timerRunning = false;
let timerMode = 'pomodoro';

const timerDisplay = document.getElementById('timerDisplay');
const btnTimerToggle = document.getElementById('btnTimerToggle');
const btnTimerReset = document.getElementById('btnTimerReset');

function updateTimerDisplay() {
  const mins = Math.floor(timerSeconds / 60);
  const secs = timerSeconds % 60;
  timerDisplay.innerText = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

btnTimerToggle.addEventListener('click', () => {
  if (timerRunning) {
    clearInterval(timerInterval);
    timerRunning = false;
    btnTimerToggle.innerText = 'Tiếp tục học';
  } else {
    timerRunning = true;
    btnTimerToggle.innerText = 'Tạm dừng';
    timerInterval = setInterval(() => {
      if (timerMode === 'pomodoro' || timerMode === 'short-break') {
        if (timerSeconds > 0) {
          timerSeconds--;
          updateTimerDisplay();
        } else {
          clearInterval(timerInterval);
          timerRunning = false;
          alert('🔔 Hết giờ phiên học/nghỉ ngơi!');
          btnTimerToggle.innerText = 'Bắt đầu';
        }
      } else {
        timerSeconds++;
        updateTimerDisplay();
      }
    }, 1000);
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

document.getElementById('btnSaveLog').addEventListener('click', () => {
  const subject = document.getElementById('logSubject').value.trim() || 'Tự học';
  const minutes = parseInt(document.getElementById('logMinutes').value, 10);
  if (!minutes || minutes <= 0) {
    alert('Vui lòng nhập số phút đã học!');
    return;
  }

  const newLog = {
    id: 'lg_' + Date.now(),
    subject,
    duration_minutes: minutes,
    date: new Date().toISOString().split('T')[0],
    notes: ''
  };

  state.studyLogs.unshift(newLog);
  saveToStorage(STORAGE_KEYS.STUDY_LOGS, state.studyLogs);
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
    item.style = 'padding: 0.6rem 0.9rem; background: #f8fafc; border: 1px solid #e4e4e7; border-radius: 10px; margin-bottom: 0.4rem; display: flex; justify-content: space-between; font-size: 0.88rem;';
    item.innerHTML = `
      <span>📚 <strong>${escapeHtml(log.subject)}</strong> (${log.duration_minutes} phút)</span>
      <span style="color: #71717a; font-size: 0.8rem;">${log.date}</span>
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
    day,
    start_time,
    end_time,
    activity,
    type
  };

  state.schedule.push(newSlot);
  saveToStorage(STORAGE_KEYS.SCHEDULE, state.schedule);
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
  localStorage.setItem(STORAGE_KEYS.API_URL, state.apiUrl);
  if (state.apiUrl) {
    updateSyncUI('synced', 'Đã lưu URL Sheet');
  } else {
    updateSyncUI('idle', 'Cục bộ (Chưa nối Sheet)');
  }
  settingsModal.classList.add('hidden');
});

document.getElementById('btnSyncNow').addEventListener('click', () => {
  state.apiUrl = inputApiUrl.value.trim();
  localStorage.setItem(STORAGE_KEYS.API_URL, state.apiUrl);
  fetchAllFromSheet();
});

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

seedDemoData();
renderAll();
