// Productivity Hub - Local-First & Optimistic UI Engine
const STORAGE_KEYS = {
  API_URL: 'ph_api_url',
  TODOS: 'ph_todos',
  NOTES: 'ph_notes',
  STUDY_LOGS: 'ph_study_logs',
  GOALS: 'ph_goals',
  SCHEDULE: 'ph_schedule'
};

// Initial App State from LocalStorage
let state = {
  apiUrl: localStorage.getItem(STORAGE_KEYS.API_URL) || '',
  todos: JSON.parse(localStorage.getItem(STORAGE_KEYS.TODOS) || '[]'),
  notes: JSON.parse(localStorage.getItem(STORAGE_KEYS.NOTES) || '[]'),
  studyLogs: JSON.parse(localStorage.getItem(STORAGE_KEYS.STUDY_LOGS) || '[]'),
  goals: JSON.parse(localStorage.getItem(STORAGE_KEYS.GOALS) || '[]'),
  schedule: JSON.parse(localStorage.getItem(STORAGE_KEYS.SCHEDULE) || '[]')
};

// Seed initial default demo data if empty
function seedDemoData() {
  if (state.goals.length === 0) {
    state.goals = [
      { id: 'g1', title: 'Hoàn thành 30 giờ tự học tháng này', target: 30, achieved: 6, unit: 'giờ' },
      { id: 'g2', title: 'Hoàn thành 50 bài tập Todo', target: 50, achieved: 12, unit: 'việc' }
    ];
    saveToStorage(STORAGE_KEYS.GOALS, state.goals);
  }
  if (state.schedule.length === 0) {
    state.schedule = [
      { id: 's1', day: 'Thứ 2', start_time: '08:00', end_time: '11:00', activity: 'Lập trình Web', type: 'Học' },
      { id: 's2', day: 'Thứ 2', start_time: '14:00', end_time: '17:00', activity: 'Tự do đọc sách / Thư giãn', type: 'Rảnh' },
      { id: 's3', day: 'Thứ 4', start_time: '19:30', end_time: '21:30', activity: 'Ôn tập tiếng Anh', type: 'Học' }
    ];
    saveToStorage(STORAGE_KEYS.SCHEDULE, state.schedule);
  }
}

// Save helpers
function saveToStorage(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
}

// -------------------------------------------------------------
// SYNC ENGINE (OPTIMISTIC UI - BACKGROUND QUEUE)
// -------------------------------------------------------------
const syncBadge = document.getElementById('syncBadge');
const syncText = document.getElementById('syncText');

function updateSyncUI(status, message) {
  syncBadge.className = `sync-badge ${status}`;
  syncText.innerText = message;
}

if (!state.apiUrl) {
  updateSyncUI('idle', 'Cục bộ (Chưa nối Sheet)');
} else {
  updateSyncUI('synced', 'Đã kết nối Sheet');
}

// Background sync to Google Sheets (Non-blocking with no-cors)
async function sendToSheet(action, sheet, payload) {
  if (!state.apiUrl) return;

  updateSyncUI('syncing', 'Đang lưu lên Sheet...');
  try {
    // mode: 'no-cors' allows browser to send POST to Google Apps Script without CORS redirect error
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

// Pull all data from Google Sheets
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
    updateSyncUI('error', 'Lỗi khi tải từ Sheet');
    alert('Không thể kết nối Google Apps Script. Kiểm tra quyền truy cập (Chọn "Anyone").');
  }
}

// -------------------------------------------------------------
// TAB NAVIGATION
// -------------------------------------------------------------
const tabButtons = document.querySelectorAll('.tab-btn');
const tabPanes = document.querySelectorAll('.tab-pane');

tabButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    tabButtons.forEach(b => b.classList.remove('active'));
    tabPanes.forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
  });
});

// -------------------------------------------------------------
// MODULE 1: DASHBOARD & STATS
// -------------------------------------------------------------
function renderDashboard() {
  // 1. Today study time
  const todayStr = new Date().toISOString().split('T')[0];
  const todayMinutes = state.studyLogs
    .filter(log => log.date === todayStr)
    .reduce((sum, item) => sum + Number(item.duration_minutes || 0), 0);
  
  const hours = Math.floor(todayMinutes / 60);
  const mins = todayMinutes % 60;
  document.getElementById('statTodayStudy').innerText = `${hours} giờ ${mins} phút`;

  // 2. Todo ratio
  const totalTodos = state.todos.length;
  const doneTodos = state.todos.filter(t => t.status === 'done').length;
  document.getElementById('statTodoRatio').innerText = `${doneTodos}/${totalTodos}`;
  const pct = totalTodos > 0 ? Math.round((doneTodos / totalTodos) * 100) : 0;
  document.getElementById('statTodoBar').style.width = `${pct}%`;

  // 3. Goals list
  document.getElementById('statGoalCount').innerText = `${state.goals.length} đang theo đuổi`;
  const goalsContainer = document.getElementById('goalsList');
  goalsContainer.innerHTML = '';

  state.goals.forEach(goal => {
    const goalPct = Math.min(100, Math.round((goal.achieved / goal.target) * 100));
    const card = document.createElement('div');
    card.className = 'goal-card';
    card.style = 'margin-bottom: 1rem; padding: 0.75rem; background: var(--bg); border-radius: 8px; border: 1px solid var(--border);';
    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; font-weight: 600; margin-bottom: 0.25rem;">
        <span>${escapeHtml(goal.title)}</span>
        <span>${goal.achieved}/${goal.target} ${goal.unit} (${goalPct}%)</span>
      </div>
      <div class="progress-bar-bg">
        <div class="progress-bar-fill" style="width: ${goalPct}%"></div>
      </div>
    `;
    goalsContainer.appendChild(card);
  });
}

// -------------------------------------------------------------
// MODULE 2: TODO LIST
// -------------------------------------------------------------
let currentTodoFilter = 'all';

function renderTodos() {
  const list = document.getElementById('todoList');
  list.innerHTML = '';
  
  const filtered = state.todos.filter(item => {
    if (currentTodoFilter === 'pending') return item.status !== 'done';
    if (currentTodoFilter === 'done') return item.status === 'done';
    return true;
  });

  document.getElementById('todoCounter').innerText = `${filtered.length} việc`;

  filtered.forEach(todo => {
    const li = document.createElement('li');
    li.className = `todo-item ${todo.status === 'done' ? 'done' : ''}`;
    const priorityClass = `priority-${(todo.priority || 'Bình-thường').replace(/\s+/g, '-')}`;
    
    li.innerHTML = `
      <div class="todo-left">
        <input type="checkbox" ${todo.status === 'done' ? 'checked' : ''} data-id="${todo.id}">
        <span>${escapeHtml(todo.task)}</span>
        <span class="badge ${priorityClass}">${todo.priority || 'Bình thường'}</span>
      </div>
      <button class="btn-delete" data-id="${todo.id}">🗑️</button>
    `;
    list.appendChild(li);
  });

  renderDashboard();
}

// Event: Add Todo (Instant 0ms)
document.getElementById('btnAddTodo').addEventListener('click', addTodo);
document.getElementById('todoInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') addTodo();
});

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

  // 1. Optimistic Update Local
  state.todos.unshift(newTodo);
  saveToStorage(STORAGE_KEYS.TODOS, state.todos);
  input.value = '';
  renderTodos();

  // 2. Sync Background to Google Sheet
  sendToSheet('append', 'Todos', { data: newTodo });
}

// Event: Toggle Todo Checkbox & Delete
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
  } else if (e.target.classList.contains('btn-delete')) {
    state.todos = state.todos.filter(t => t.id !== id);
    saveToStorage(STORAGE_KEYS.TODOS, state.todos);
    renderTodos();
    sendToSheet('delete', 'Todos', { id });
  }
});

// Todo Filter Buttons
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
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
    title: title || 'Ghi chú không tên',
    content: content,
    updated_at: new Date().toLocaleDateString('vi-VN')
  };

  // Optimistic UI
  state.notes.unshift(newNote);
  saveToStorage(STORAGE_KEYS.NOTES, state.notes);
  document.getElementById('noteTitle').value = '';
  document.getElementById('noteContent').value = '';
  noteForm.classList.add('hidden');
  renderNotes();

  // Background Sync
  sendToSheet('append', 'Notes', { data: newNote });
});

function renderNotes() {
  const grid = document.getElementById('notesGrid');
  grid.innerHTML = '';

  state.notes.forEach(note => {
    const card = document.createElement('div');
    card.className = 'note-card';
    card.innerHTML = `
      <div>
        <h3>${escapeHtml(note.title)}</h3>
        <p>${escapeHtml(note.content)}</p>
      </div>
      <div class="note-meta">
        <span>${note.updated_at || ''}</span>
        <button class="btn-delete" data-id="${note.id}">🗑️</button>
      </div>
    `;
    grid.appendChild(card);
  });
}

document.getElementById('notesGrid').addEventListener('click', (e) => {
  const id = e.target.dataset.id;
  if (!id) return;
  if (confirm('Bạn có chắc muốn xóa ghi chú này?')) {
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
let timerMode = 'pomodoro'; // 'pomodoro' or 'stopwatch'

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
    // Pause
    clearInterval(timerInterval);
    timerRunning = false;
    btnTimerToggle.innerText = 'Tiếp tục học';
  } else {
    // Start
    timerRunning = true;
    btnTimerToggle.innerText = 'Tạm dừng';
    timerInterval = setInterval(() => {
      if (timerMode === 'pomodoro') {
        if (timerSeconds > 0) {
          timerSeconds--;
          updateTimerDisplay();
        } else {
          clearInterval(timerInterval);
          timerRunning = false;
          alert('🔔 Hết giờ học Pomodoro! Nghỉ ngơi 5 phút nhé!');
          btnTimerToggle.innerText = 'Bắt đầu';
        }
      } else {
        // Stopwatch count up
        timerSeconds++;
        updateTimerDisplay();
      }
    }, 1000);
  }
});

btnTimerReset.addEventListener('click', () => {
  clearInterval(timerInterval);
  timerRunning = false;
  timerSeconds = timerMode === 'pomodoro' ? 25 * 60 : 0;
  btnTimerToggle.innerText = 'Bắt đầu học';
  updateTimerDisplay();
});

// Switch mode
document.querySelectorAll('.mode-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    timerMode = btn.dataset.mode;
    clearInterval(timerInterval);
    timerRunning = false;
    timerSeconds = timerMode === 'pomodoro' ? 25 * 60 : 0;
    btnTimerToggle.innerText = 'Bắt đầu học';
    updateTimerDisplay();
  });
});

// Save Log manually
document.getElementById('btnSaveLog').addEventListener('click', () => {
  const subject = document.getElementById('logSubject').value.trim() || 'Tự học chung';
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
  container.innerHTML = '';
  state.studyLogs.slice(0, 10).forEach(log => {
    const item = document.createElement('div');
    item.style = 'padding: 0.6rem 0.8rem; background: var(--bg); border: 1px solid var(--border); border-radius: 6px; margin-bottom: 0.5rem; display: flex; justify-content: space-between; font-size: 0.9rem;';
    item.innerHTML = `
      <span>📚 <strong>${escapeHtml(log.subject)}</strong> (${log.duration_minutes} phút)</span>
      <span style="color: var(--text-muted); font-size: 0.8rem;">${log.date}</span>
    `;
    container.appendChild(item);
  });
}

// -------------------------------------------------------------
// MODULE 5: SCHEDULE (LỊCH HỌC & LỊCH RẢNH)
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
    const col = document.querySelector(`.day-col[data-day="${day}"] .day-slots`);
    if (!col) return;
    col.innerHTML = '';
    const slots = state.schedule.filter(s => s.day === day);
    slots.sort((a, b) => a.start_time.localeCompare(b.start_time));

    slots.forEach(slot => {
      const div = document.createElement('div');
      div.className = `slot-item type-${slot.type}`;
      div.innerHTML = `
        <div class="slot-time">${slot.start_time} - ${slot.end_time}</div>
        <div>${escapeHtml(slot.activity)}</div>
      `;
      col.appendChild(div);
    });
  });
}

// -------------------------------------------------------------
// SETTINGS & MODAL
// -------------------------------------------------------------
const settingsModal = document.getElementById('settingsModal');
const inputApiUrl = document.getElementById('inputApiUrl');

document.getElementById('btnSettings').addEventListener('click', () => {
  inputApiUrl.value = state.apiUrl;
  settingsModal.classList.remove('hidden');
});

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

// Helper XSS Escape
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

// Initial Render All
function renderAll() {
  renderDashboard();
  renderTodos();
  renderNotes();
  renderStudyLogs();
  renderSchedule();
}

seedDemoData();
renderAll();
