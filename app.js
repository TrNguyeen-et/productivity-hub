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

// Monochrome SVG Icons for P1 (Girl) and P2 (Boy) - strictly black/white line art
const ICON_GIRL_SVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="7" r="4"/><path d="M5.5 21v-2a5 5 0 0 1 10 0v2"/><path d="M16 6.5c1.8 1.2 2.8 3.2 2.2 5.5s-2.2 3.5-3.7 3.5"/></svg>`;
const ICON_BOY_SVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="7" r="4"/><path d="M6 21v-2a4.5 4.5 0 0 1 9 0v2"/><path d="M9.5 4c1-1 3-1 4 0"/></svg>`;

// Automatic purge of demo/garbage data on startup to guarantee a 100% clean state
(function cleanDemoDataFromStorage() {
  const users = ['sun', 'icarus', 'default'];
  users.forEach(u => {
    // 1. Purge demo study logs (lg_demo_*)
    const logKey = `ph_${u}_study_logs`;
    try {
      const logs = JSON.parse(localStorage.getItem(logKey) || '[]');
      const cleanLogs = logs.filter(l => l && l.id && !l.id.startsWith('lg_demo_'));
      localStorage.setItem(logKey, JSON.stringify(cleanLogs));
    } catch(e) {}

    // 2. Purge demo goals (g1, g2)
    const goalKey = `ph_${u}_goals`;
    try {
      const goals = JSON.parse(localStorage.getItem(goalKey) || '[]');
      const cleanGoals = goals.filter(g => g && g.id !== 'g1' && g.id !== 'g2');
      localStorage.setItem(goalKey, JSON.stringify(cleanGoals));
    } catch(e) {}

    // 3. Purge demo schedule (s1, s2, s3, s4)
    const schKey = `ph_${u}_schedule`;
    try {
      const sch = JSON.parse(localStorage.getItem(schKey) || '[]');
      const cleanSch = sch.filter(s => s && !['s1', 's2', 's3', 's4'].includes(s.id));
      localStorage.setItem(schKey, JSON.stringify(cleanSch));
    } catch(e) {}
  });

  // Remove any legacy single-user keys
  localStorage.removeItem('ph_study_logs');
  localStorage.removeItem('ph_goals');
  localStorage.removeItem('ph_schedule');
})();

function loadUserData(user) {
  activeUser = user;
  localStorage.setItem('ph_active_user', user);

  const isSun = user === 'sun';
  const iconSvg = isSun ? ICON_GIRL_SVG : ICON_BOY_SVG;

  // Update header label & icon (strictly monochrome)
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

  // Load state for this user (strictly clean)
  state.apiUrl = localStorage.getItem(getUserKey('api_url')) || localStorage.getItem('ph_shared_api_url') || '';
  state.todos = JSON.parse(localStorage.getItem(getUserKey('todos')) || '[]');
  state.notes = JSON.parse(localStorage.getItem(getUserKey('notes')) || '[]');
  state.studyLogs = JSON.parse(localStorage.getItem(getUserKey('study_logs')) || '[]');
  state.goals = JSON.parse(localStorage.getItem(getUserKey('goals')) || '[]');
  state.schedule = JSON.parse(localStorage.getItem(getUserKey('schedule')) || '[]');

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
        state.todos = json.data.Todos.filter(t => (!t.user || t.user === activeUser) && (!t.id || !t.id.startsWith('td_demo_')));
        saveToStorage('todos', state.todos);
      }
      if (json.data.Notes) {
        state.notes = json.data.Notes.filter(n => (!n.user || n.user === activeUser) && (!n.id || !n.id.startsWith('nt_demo_')));
        saveToStorage('notes', state.notes);
      }
      if (json.data.StudyLogs) {
        state.studyLogs = json.data.StudyLogs.filter(l => (!l.user || l.user === activeUser) && (!l.id || !l.id.startsWith('lg_demo_')));
        saveToStorage('study_logs', state.studyLogs);
      }
      if (json.data.Schedule) {
        state.schedule = json.data.Schedule.filter(s => (!s.user || s.user === activeUser) && (!s.id || !['s1', 's2', 's3', 's4'].includes(s.id)));
        saveToStorage('schedule', state.schedule);
      }
      if (json.data.Goals) {
        state.goals = json.data.Goals.filter(g => (!g.user || g.user === activeUser) && (!g.id || !['g1', 'g2'].includes(g.id)));
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
  const btn = document.getElementById('btnStartStopwatch');
  if (btn) btn.click();
});

// -------------------------------------------------------------
// MODULE 1: DASHBOARD & GITHUB-STYLE ACTIVITY HEATMAP
// -------------------------------------------------------------
function renderDashboard() {
  const todayStr = new Date().toISOString().split('T')[0];

  // 1. Study Hours KPI (chỉ tính phiên học hợp lệ, không tính phiên bỏ cuộc)
  const todayMinutes = state.studyLogs
    .filter(log => log.date === todayStr && !log.abandoned && Number(log.duration_minutes || 0) > 0)
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
    if (!log.date || log.abandoned || !log.duration_minutes) return;
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

  const dayLabels = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
  const now = new Date();
  const currentDayIdx = (now.getDay() + 6) % 7; // 0 for Monday, 6 for Sunday
  const monday = new Date(now);
  monday.setDate(now.getDate() - currentDayIdx);

  dayLabels.forEach((day, idx) => {
    const targetDate = new Date(monday);
    targetDate.setDate(monday.getDate() + idx);
    const dateStr = targetDate.toISOString().split('T')[0];

    // Minutes studied on this day (không tính bỏ cuộc)
    const dayMins = state.studyLogs
      .filter(l => l.date === dateStr && !l.abandoned && Number(l.duration_minutes || 0) > 0)
      .reduce((sum, l) => sum + Number(l.duration_minutes || 0), 0);

    // Completed tasks on this day
    const dayTasks = state.todos
      .filter(t => t.status === 'done' && (t.completed_at === dateStr || t.created_at === targetDate.toLocaleDateString('vi-VN')))
      .length;

    // Relative height percentages (3h target = 100%, 4 todos target = 100%)
    const darkPct = dayMins > 0 ? Math.min(100, Math.round((dayMins / 180) * 100)) : 0;
    const limePct = dayTasks > 0 ? Math.min(100, Math.round((dayTasks / 4) * 100)) : 0;

    const col = document.createElement('div');
    col.className = 'dual-bar-col';
    col.innerHTML = `
      <div class="dual-capsule-track" title="${day} (${dateStr}): ${dayMins} phút học, ${dayTasks} việc xong">
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

  if (state.goals.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; color: var(--text-muted); font-size: 0.85rem; padding: 1.5rem 0;">
        Chưa có mục tiêu nào. Nhấn <strong>+ Thêm mục tiêu</strong> để bắt đầu!
      </div>
    `;
    return;
  }

  state.goals.forEach(goal => {
    const pct = goal.target > 0 ? Math.min(100, Math.round((goal.achieved / goal.target) * 100)) : 0;
    const item = document.createElement('div');
    item.className = 'goal-item';
    item.innerHTML = `
      <div class="goal-info">
        <span style="font-weight: 600;">${escapeHtml(goal.title)}</span>
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <span style="font-size: 0.8rem; color: var(--text-muted);">${goal.achieved}/${goal.target} ${goal.unit} (${pct}%)</span>
          <button class="btn-goal-inc" data-id="${goal.id}" title="Tăng +1 tiến độ" style="background: none; border: 1px solid var(--border-light); border-radius: 4px; padding: 1px 6px; cursor: pointer; color: var(--text-dark); font-size: 0.75rem;">+1</button>
          <button class="btn-goal-del" data-id="${goal.id}" title="Xóa mục tiêu" style="background: none; border: none; cursor: pointer; color: var(--text-muted); font-size: 0.85rem;">✕</button>
        </div>
      </div>
      <div class="progress-track" style="margin-top: 0.4rem;">
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
// MODULE 4: STUDY TIMER & LOGS (STOPWATCH & POMODORO WITH URGENT & GIVE-UP FLOW)
// -------------------------------------------------------------
let timerInterval = null;
let timerRunning = false;
let timerSeconds = 0; // Mặc định là 0
let timerMode = 'idle'; // 'idle', 'stopwatch', 'pomodoro'
let stopwatchAccumulatedSec = 0;
let lastResumeTimestamp = null;
let pomodoroTargetTimestamp = null;
let pendingElapsedMinutes = 0;

// iPad / Mobile Media Session (Thanh điều khiển Lock Screen & Chạy nền)
const silentAudio = new Audio('silent.wav');
silentAudio.loop = true;

function playSilentAudio() {
  if (!silentAudio) return;
  silentAudio.play().then(() => {
    updateMediaSession();
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = 'playing';
    }
  }).catch(() => {});
}

function pauseSilentAudio() {
  if (!silentAudio) return;
  silentAudio.pause();
  if ('mediaSession' in navigator) {
    navigator.mediaSession.playbackState = 'paused';
  }
}

function stopSilentAudio() {
  if (!silentAudio) return;
  silentAudio.pause();
  silentAudio.currentTime = 0;
  if ('mediaSession' in navigator) {
    navigator.mediaSession.playbackState = 'none';
  }
}

function updateMediaSession() {
  if (!('mediaSession' in navigator)) return;
  const modeName = timerMode === 'pomodoro' ? '🍅 Pomodoro' : '📖 Tự học';
  const timeStr = timerDisplay ? timerDisplay.innerText : '00:00';

  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: `${modeName}: ${timeStr}`,
      artist: 'I wanna be better (Đang chạy nền)',
      album: '⏭ Kết thúc & Lưu | ⏮ Huỷ | ⏸ Tạm dừng',
      artwork: [
        { src: 'favicon.ico', sizes: '96x96', type: 'image/x-icon' },
        { src: 'favicon.ico', sizes: '192x192', type: 'image/x-icon' }
      ]
    });
  } catch (e) {}
}

function initMediaSessionHandlers() {
  if (!('mediaSession' in navigator)) return;

  const actionMap = {
    play: () => {
      if (!timerRunning && timerMode === 'stopwatch' && btnStopwatchPause) {
        btnStopwatchPause.click();
      } else {
        playSilentAudio();
      }
    },
    pause: () => {
      if (timerRunning && timerMode === 'stopwatch' && btnStopwatchPause) {
        btnStopwatchPause.click();
      } else {
        pauseSilentAudio();
      }
    },
    stop: () => {
      if (timerMode === 'stopwatch' && btnStopwatchFinish) {
        btnStopwatchFinish.click();
      }
    },
    nexttrack: () => {
      // Bấm nút Next trên màn hình khoá / thanh iPad -> Kết thúc và lưu luôn
      if (timerMode === 'stopwatch' && btnStopwatchFinish) {
        btnStopwatchFinish.click();
      } else if (timerMode === 'pomodoro' && btnPomodoroUrgent) {
        btnPomodoroUrgent.click();
      }
    },
    previoustrack: () => {
      // Bấm nút Previous trên màn hình khoá / thanh iPad -> Huỷ kết quả
      if (timerMode === 'stopwatch' && btnStopwatchCancel) {
        btnStopwatchCancel.click();
      } else if (timerMode === 'pomodoro' && btnPomodoroCancel) {
        btnPomodoroCancel.click();
      }
    }
  };

  for (const [action, handler] of Object.entries(actionMap)) {
    try {
      navigator.mediaSession.setActionHandler(action, handler);
    } catch (e) {}
  }
}
initMediaSessionHandlers();

// Picture-in-Picture (Cửa sổ nổi PiP) cho iPad / Điện thoại
let pipCanvas = null;
let pipCtx = null;
let pipVideo = null;
const btnTogglePip = document.getElementById('btnTogglePip');

function initPipVideo() {
  if (pipVideo) return;
  pipCanvas = document.createElement('canvas');
  pipCanvas.width = 400;
  pipCanvas.height = 200;
  pipCtx = pipCanvas.getContext('2d');

  pipVideo = document.createElement('video');
  pipVideo.muted = true;
  pipVideo.autoplay = true;
  pipVideo.playsInline = true;
  pipVideo.style.display = 'none';
  document.body.appendChild(pipVideo);

  if (pipCanvas.captureStream) {
    pipVideo.srcObject = pipCanvas.captureStream(2);
  }
}

function renderPipCanvas() {
  if (!pipCtx || !pipCanvas) return;
  const isDark = document.body.classList.contains('dark-mode');
  pipCtx.fillStyle = isDark ? '#121316' : '#ffffff';
  pipCtx.fillRect(0, 0, pipCanvas.width, pipCanvas.height);

  pipCtx.fillStyle = isDark ? '#ffffff' : '#121316';
  pipCtx.font = 'bold 74px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  pipCtx.textAlign = 'center';
  pipCtx.textBaseline = 'middle';
  pipCtx.fillText(timerDisplay?.innerText || '00:00', pipCanvas.width / 2, pipCanvas.height / 2 - 15);

  pipCtx.font = 'bold 22px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  pipCtx.fillStyle = timerMode === 'pomodoro' ? '#ef4444' : '#10b981';
  const label = timerMode === 'pomodoro' ? '🍅 Pomodoro' : '📖 I wanna be better';
  pipCtx.fillText(label, pipCanvas.width / 2, pipCanvas.height / 2 + 50);
}

if (btnTogglePip) {
  btnTogglePip.addEventListener('click', async () => {
    initPipVideo();
    renderPipCanvas();

    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (pipVideo && pipVideo.requestPictureInPicture) {
        await pipVideo.play();
        await pipVideo.requestPictureInPicture();
      } else {
        alert('Trình duyệt hoặc thiết bị chưa hỗ trợ tính năng Cửa sổ nổi PiP.');
      }
    } catch (err) {
      console.warn('PiP error:', err);
      alert('Để mở cửa sổ nổi PiP, hãy bấm Bắt đầu học trước rồi bấm lại nút này.');
    }
  });
}

const timerDisplay = document.getElementById('timerDisplay');
const timerActionIdle = document.getElementById('timerActionIdle');
const timerActionStopwatch = document.getElementById('timerActionStopwatch');
const timerActionPomodoro = document.getElementById('timerActionPomodoro');

const btnStartStopwatch = document.getElementById('btnStartStopwatch');
const btnStartPomodoro = document.getElementById('btnStartPomodoro');
const btnStopwatchPause = document.getElementById('btnStopwatchPause');
const btnStopwatchFinish = document.getElementById('btnStopwatchFinish');
const btnStopwatchCancel = document.getElementById('btnStopwatchCancel');
const btnPomodoroGiveUp = document.getElementById('btnPomodoroGiveUp');
const btnPomodoroUrgent = document.getElementById('btnPomodoroUrgent');
const btnPomodoroCancel = document.getElementById('btnPomodoroCancel');

// Modals
const finishSessionModal = document.getElementById('finishSessionModal');
const btnCloseFinishModal = document.getElementById('btnCloseFinishModal');
const btnCancelFinishModal = document.getElementById('btnCancelFinishModal');
const btnConfirmFinishModal = document.getElementById('btnConfirmFinishModal');
const finishSubjectInput = document.getElementById('finishSubjectInput');
const finishNotesInput = document.getElementById('finishNotesInput');
const finishModalDurationDesc = document.getElementById('finishModalDurationDesc');

const urgentReasonModal = document.getElementById('urgentReasonModal');
const btnCloseUrgentModal = document.getElementById('btnCloseUrgentModal');
const btnCancelUrgentModal = document.getElementById('btnCancelUrgentModal');
const btnConfirmUrgentModal = document.getElementById('btnConfirmUrgentModal');
const urgentSubjectInput = document.getElementById('urgentSubjectInput');
const urgentReasonInput = document.getElementById('urgentReasonInput');
const urgentModalDurationDesc = document.getElementById('urgentModalDurationDesc');

function updateTimerDisplay() {
  if (!timerDisplay) return;
  const mins = Math.floor(timerSeconds / 60);
  const secs = timerSeconds % 60;
  timerDisplay.innerText = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function resetToIdle() {
  clearInterval(timerInterval);
  timerInterval = null;
  timerRunning = false;
  timerMode = 'idle';
  timerSeconds = 0;
  stopwatchAccumulatedSec = 0;
  lastResumeTimestamp = null;
  pomodoroTargetTimestamp = null;
  pendingElapsedMinutes = 0;

  stopSilentAudio();
  updateTimerDisplay();
  renderPipCanvas();

  if (timerActionIdle) timerActionIdle.classList.remove('hidden');
  if (timerActionStopwatch) timerActionStopwatch.classList.add('hidden');
  if (timerActionPomodoro) timerActionPomodoro.classList.add('hidden');
}

function tickTimer() {
  const now = Date.now();
  if (timerMode === 'stopwatch') {
    // Đếm xuôi từ 0
    let currentChunk = 0;
    if (lastResumeTimestamp) {
      currentChunk = Math.round((now - lastResumeTimestamp) / 1000);
    }
    timerSeconds = stopwatchAccumulatedSec + currentChunk;
    updateTimerDisplay();
    updateMediaSession();
    renderPipCanvas();
  } else if (timerMode === 'pomodoro') {
    // Đếm ngược từ 25:00 về 0
    timerSeconds = Math.max(0, Math.round((pomodoroTargetTimestamp - now) / 1000));
    updateTimerDisplay();
    updateMediaSession();
    renderPipCanvas();

    if (timerSeconds <= 0) {
      clearInterval(timerInterval);
      timerRunning = false;
      stopSilentAudio();
      
      const newLog = {
        id: 'lg_' + Date.now(),
        user: activeUser,
        subject: 'Pomodoro',
        duration_minutes: 25,
        date: new Date().toISOString().split('T')[0],
        notes: 'Hoàn thành trọn vẹn 25 phút Pomodoro'
      };

      state.studyLogs.unshift(newLog);
      saveToStorage('study_logs', state.studyLogs);
      renderStudyLogs();
      renderDashboard();

      sendToSheet('append', 'StudyLogs', { data: newLog });
      resetToIdle();

      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('🔔 Hoàn thành 25 phút Pomodoro!', {
          body: 'Tuyệt vời! Phiên học đã được tự động lưu vào lịch sử.',
          icon: 'favicon.ico'
        });
      }

      alert('🔔 Chúc mừng! Bạn đã hoàn thành trọn vẹn 25 phút Pomodoro (Đã tự động lưu vào lịch sử học tập)!');
    }
  }
}

// 1. Chế độ ĐẾM XUÔI (Bấm "▶ Bắt đầu")
if (btnStartStopwatch) {
  btnStartStopwatch.addEventListener('click', () => {
    timerMode = 'stopwatch';
    timerSeconds = 0;
    stopwatchAccumulatedSec = 0;
    timerRunning = true;
    lastResumeTimestamp = Date.now();

    updateTimerDisplay();
    playSilentAudio();

    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    if (timerActionIdle) timerActionIdle.classList.add('hidden');
    if (timerActionStopwatch) timerActionStopwatch.classList.remove('hidden');
    if (timerActionPomodoro) timerActionPomodoro.classList.add('hidden');
    if (btnStopwatchPause) btnStopwatchPause.innerText = '⏸ Tạm dừng';

    timerInterval = setInterval(tickTimer, 1000);
  });
}

// Nút Tạm dừng / Tiếp tục đếm xuôi
if (btnStopwatchPause) {
  btnStopwatchPause.addEventListener('click', () => {
    if (timerRunning) {
      // Tạm dừng thời gian (không lưu)
      clearInterval(timerInterval);
      timerRunning = false;
      btnStopwatchPause.innerText = '▶ Tiếp tục';
      if (lastResumeTimestamp) {
        stopwatchAccumulatedSec += Math.round((Date.now() - lastResumeTimestamp) / 1000);
      }
      lastResumeTimestamp = null;
      pauseSilentAudio();
    } else {
      // Tiếp tục đếm
      timerRunning = true;
      btnStopwatchPause.innerText = '⏸ Tạm dừng';
      lastResumeTimestamp = Date.now();
      playSilentAudio();
      timerInterval = setInterval(tickTimer, 1000);
    }
  });
}

// Nút Kết thúc đếm xuôi -> Tự động lưu thời gian đã học vào lịch sử & Sheet
if (btnStopwatchFinish) {
  btnStopwatchFinish.addEventListener('click', () => {
    // Dừng timer
    clearInterval(timerInterval);
    if (timerRunning && lastResumeTimestamp) {
      stopwatchAccumulatedSec += Math.round((Date.now() - lastResumeTimestamp) / 1000);
    }
    timerRunning = false;
    lastResumeTimestamp = null;

    const totalSec = stopwatchAccumulatedSec || timerSeconds || 0;
    if (totalSec <= 0) {
      resetToIdle();
      return;
    }

    // Tự động tính số phút đã học (nếu dưới 60s tính là 1 phút, ghi rõ số giây trong notes)
    const durationMinutes = totalSec < 60 ? 1 : Math.max(1, Math.round(totalSec / 60));
    const timeNote = totalSec < 60 ? `Tự học ${totalSec}s` : `Phiên học ${durationMinutes} phút`;

    const newLog = {
      id: 'lg_' + Date.now(),
      user: activeUser,
      subject: 'Tự học',
      duration_minutes: durationMinutes,
      date: new Date().toISOString().split('T')[0],
      notes: timeNote
    };

    // Tự động lưu ngay lập tức
    state.studyLogs.unshift(newLog);
    saveToStorage('study_logs', state.studyLogs);
    renderStudyLogs();
    renderDashboard();

    sendToSheet('append', 'StudyLogs', { data: newLog });
    resetToIdle();

    alert(`🎉 Đã tự động lưu phiên học: ${durationMinutes} phút (${totalSec < 60 ? totalSec + 's' : durationMinutes + ' phút'}) vào lịch sử học tập!`);
  });
}

// Nút Huỷ kết quả đếm xuôi -> Không lưu gì cả, trở về 00:00
if (btnStopwatchCancel) {
  btnStopwatchCancel.addEventListener('click', () => {
    resetToIdle();
  });
}

// 2. Chế độ POMODORO ĐẾM NGƯỢC 25m (Bấm "🍅 Pomodoro")
if (btnStartPomodoro) {
  btnStartPomodoro.addEventListener('click', () => {
    timerMode = 'pomodoro';
    timerSeconds = 25 * 60; // 1500s
    timerRunning = true;
    pomodoroTargetTimestamp = Date.now() + 25 * 60 * 1000;

    updateTimerDisplay();
    playSilentAudio();

    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    if (timerActionIdle) timerActionIdle.classList.add('hidden');
    if (timerActionStopwatch) timerActionStopwatch.classList.add('hidden');
    if (timerActionPomodoro) timerActionPomodoro.classList.remove('hidden');

    timerInterval = setInterval(tickTimer, 1000);
  });
}

// Nút Huỷ phiên Pomodoro -> Không lưu, trở về 00:00
if (btnPomodoroCancel) {
  btnPomodoroCancel.addEventListener('click', () => {
    resetToIdle();
  });
}

// Bấm "Có việc gấp" trong Pomodoro -> Mở bảng điền lý do
if (btnPomodoroUrgent) {
  btnPomodoroUrgent.addEventListener('click', () => {
    clearInterval(timerInterval);
    timerRunning = false;

    const elapsedSec = (25 * 60) - timerSeconds;
    pendingElapsedMinutes = Math.max(1, Math.round(elapsedSec / 60));

    if (urgentModalDurationDesc) {
      urgentModalDurationDesc.innerHTML = `Bạn đã tập trung được <strong>${pendingElapsedMinutes} phút</strong> trước khi có việc bận.`;
    }
    if (urgentSubjectInput) urgentSubjectInput.value = 'Pomodoro';
    if (urgentReasonInput) urgentReasonInput.value = '';
    if (urgentReasonModal) urgentReasonModal.classList.remove('hidden');
    if (urgentReasonInput) urgentReasonInput.focus();
  });
}

// Bấm "Bỏ cuộc" trong Pomodoro -> Ghi nhận dấu ! và description "Bỏ cuộc", KHÔNG tính giờ
if (btnPomodoroGiveUp) {
  btnPomodoroGiveUp.addEventListener('click', () => {
    if (!confirm('Bạn có chắc muốn bỏ cuộc phiên Pomodoro này không? Phiên sẽ được đưa xuống lịch sử với dấu [!] và KHÔNG được tính vào tổng giờ học.')) {
      return;
    }

    clearInterval(timerInterval);
    timerRunning = false;

    const newLog = {
      id: 'lg_' + Date.now(),
      user: activeUser,
      subject: 'Pomodoro',
      duration_minutes: 0,
      abandoned: true,
      notes: 'Bỏ cuộc',
      date: new Date().toISOString().split('T')[0]
    };

    state.studyLogs.unshift(newLog);
    saveToStorage('study_logs', state.studyLogs);
    renderStudyLogs();
    renderDashboard();

    sendToSheet('append', 'StudyLogs', { data: newLog });
    resetToIdle();
    alert('Đã ghi nhận phiên Pomodoro với trạng thái "Bỏ cuộc" (!) trong lịch sử học tập.');
  });
}

// Xử lý Modal: Ghi nhận phiên học (Lưu thông tin)
function saveFinishSession() {
  const subject = (finishSubjectInput?.value || '').trim() || 'Tự học';
  const notes = (finishNotesInput?.value || '').trim();

  const newLog = {
    id: 'lg_' + Date.now(),
    user: activeUser,
    subject,
    duration_minutes: pendingElapsedMinutes,
    date: new Date().toISOString().split('T')[0],
    notes: notes || 'Hoàn thành phiên học'
  };

  state.studyLogs.unshift(newLog);
  saveToStorage('study_logs', state.studyLogs);
  renderStudyLogs();
  renderDashboard();

  sendToSheet('append', 'StudyLogs', { data: newLog });

  if (finishSessionModal) finishSessionModal.classList.add('hidden');
  resetToIdle();
  alert(`🎉 Đã lưu phiên học vào lịch sử: "${subject}" (${pendingElapsedMinutes} phút)!`);
}

if (btnConfirmFinishModal) btnConfirmFinishModal.addEventListener('click', saveFinishSession);
if (btnCloseFinishModal) btnCloseFinishModal.addEventListener('click', () => {
  if (finishSessionModal) finishSessionModal.classList.add('hidden');
  resetToIdle();
});
if (btnCancelFinishModal) btnCancelFinishModal.addEventListener('click', () => {
  if (finishSessionModal) finishSessionModal.classList.add('hidden');
  resetToIdle();
});

// Xử lý Modal: Có việc gấp (Lưu lý do)
function saveUrgentSession() {
  const subject = (urgentSubjectInput?.value || '').trim() || 'Pomodoro';
  const reason = (urgentReasonInput?.value || '').trim() || 'Có việc gấp';

  const newLog = {
    id: 'lg_' + Date.now(),
    user: activeUser,
    subject,
    duration_minutes: pendingElapsedMinutes,
    has_urgent_reason: true,
    notes: reason,
    date: new Date().toISOString().split('T')[0]
  };

  state.studyLogs.unshift(newLog);
  saveToStorage('study_logs', state.studyLogs);
  renderStudyLogs();
  renderDashboard();

  sendToSheet('append', 'StudyLogs', { data: newLog });

  if (urgentReasonModal) urgentReasonModal.classList.add('hidden');
  resetToIdle();
  alert(`Đã lưu phiên học: "${subject}" (${pendingElapsedMinutes} phút) với lý do: "${reason}"!`);
}

if (btnConfirmUrgentModal) btnConfirmUrgentModal.addEventListener('click', saveUrgentSession);
if (btnCloseUrgentModal) btnCloseUrgentModal.addEventListener('click', () => {
  if (urgentReasonModal) urgentReasonModal.classList.add('hidden');
  resetToIdle();
});
if (btnCancelUrgentModal) btnCancelUrgentModal.addEventListener('click', () => {
  if (urgentReasonModal) urgentReasonModal.classList.add('hidden');
  resetToIdle();
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

// Render danh sách lịch sử học tập
function renderStudyLogs() {
  const container = document.getElementById('studyLogsList');
  if (!container) return;
  container.innerHTML = '';

  if (state.studyLogs.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; color: var(--text-muted); font-size: 0.85rem; padding: 1.5rem 0;">
        Chưa có phiên học nào. Bắt đầu bấm giờ học hoặc chọn Pomodoro ở trên!
      </div>
    `;
    return;
  }

  state.studyLogs.slice(0, 15).forEach(log => {
    const item = document.createElement('div');
    item.className = `study-log-item ${log.abandoned ? 'abandoned-item' : ''}`;

    let mainHtml = '';
    if (log.abandoned) {
      mainHtml = `
        <div style="display: flex; align-items: center; gap: 0.65rem;">
          <span class="badge-give-up" title="Bỏ cuộc">!</span>
          <div>
            <strong style="color: var(--text-muted);">${escapeHtml(log.subject || 'Pomodoro')}</strong>
            <span style="font-size: 0.78rem; color: #ef4444; margin-left: 0.35rem; font-weight: 700;">(Bỏ cuộc - Không tính giờ)</span>
            <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;">${escapeHtml(log.notes || 'Bỏ cuộc')}</div>
          </div>
        </div>
      `;
    } else if (log.has_urgent_reason) {
      mainHtml = `
        <div>
          <div style="display: flex; align-items: center; gap: 0.4rem;">
            <span style="color: #f59e0b; font-size: 0.95rem;">⚡</span>
            <strong>${escapeHtml(log.subject || 'Pomodoro')}</strong>
            <span style="font-size: 0.82rem; color: var(--text-muted);">· ${log.duration_minutes} phút</span>
          </div>
          <div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 2px;">
            Lý do: <em>${escapeHtml(log.notes || 'Có việc gấp')}</em>
          </div>
        </div>
      `;
    } else {
      mainHtml = `
        <div>
          <strong>${escapeHtml(log.subject || 'Tự học')}</strong>
          <span style="font-size: 0.82rem; color: var(--text-muted);">· ${log.duration_minutes} phút</span>
          ${log.notes ? `<div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 2px;">${escapeHtml(log.notes)}</div>` : ''}
        </div>
      `;
    }

    item.innerHTML = `
      ${mainHtml}
      <div style="display: flex; align-items: center; gap: 0.65rem;">
        <span class="log-date">${log.date || ''}</span>
        <button class="btn-delete-study-log" data-id="${log.id}" title="Xoá phiên học này" style="background: none; border: none; cursor: pointer; color: var(--text-muted); font-size: 1.1rem; padding: 0 4px; border-radius: 4px; line-height: 1;">×</button>
      </div>
    `;

    container.appendChild(item);
  });
}

// Bắt sự kiện xoá phiên học
const studyLogsListElem = document.getElementById('studyLogsList');
if (studyLogsListElem) {
  studyLogsListElem.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-delete-study-log');
    if (!btn) return;
    const logId = btn.getAttribute('data-id');
    if (!logId) return;

    if (confirm('Bạn có chắc muốn xoá phiên học này khỏi lịch sử không?')) {
      state.studyLogs = state.studyLogs.filter(l => l.id !== logId);
      saveToStorage('study_logs', state.studyLogs);
      renderStudyLogs();
      renderDashboard();
      sendToSheet('delete', 'StudyLogs', { id: logId });
    }
  });
}

// Goals Event Handlers
const btnAddGoal = document.getElementById('btnAddGoal');
if (btnAddGoal) {
  btnAddGoal.addEventListener('click', () => {
    const title = prompt('Nhập tên mục tiêu (VD: Tự học 50 giờ, Đọc 5 cuốn sách):');
    if (!title || !title.trim()) return;
    const targetStr = prompt('Nhập số lượng mục tiêu cần đạt (VD: 50):', '50');
    const target = parseFloat(targetStr) || 10;
    const unit = prompt('Đơn vị (VD: giờ, việc, bài, cuốn):', 'giờ') || 'giờ';

    const newGoal = {
      id: 'gl_' + Date.now(),
      user: activeUser,
      title: title.trim(),
      target,
      achieved: 0,
      unit: unit.trim()
    };
    state.goals.push(newGoal);
    saveToStorage('goals', state.goals);
    renderGoalsList();
    sendToSheet('append', 'Goals', { data: newGoal });
  });
}

const goalsList = document.getElementById('goalsList');
if (goalsList) {
  goalsList.addEventListener('click', (e) => {
    const incBtn = e.target.closest('.btn-goal-inc');
    if (incBtn) {
      const id = incBtn.dataset.id;
      const g = state.goals.find(item => item.id === id);
      if (g) {
        g.achieved = Math.min(g.target, Number(g.achieved || 0) + 1);
        saveToStorage('goals', state.goals);
        renderGoalsList();
        sendToSheet('update_status', 'Goals', { id, achieved: g.achieved });
      }
      return;
    }
    const delBtn = e.target.closest('.btn-goal-del');
    if (delBtn) {
      const id = delBtn.dataset.id;
      if (confirm('Xóa mục tiêu này?')) {
        state.goals = state.goals.filter(item => item.id !== id);
        saveToStorage('goals', state.goals);
        renderGoalsList();
        sendToSheet('delete', 'Goals', { id });
      }
    }
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

const btnPurge = document.getElementById('btnPurgeDataModal');
if (btnPurge) {
  btnPurge.addEventListener('click', () => {
    if (confirm('Bạn có chắc muốn xóa toàn bộ dữ liệu mẫu/rác để bắt đầu với trang hoàn toàn sạch sẽ không?')) {
      ['sun', 'icarus', 'default'].forEach(u => {
        ['todos', 'notes', 'study_logs', 'goals', 'schedule'].forEach(key => {
          localStorage.removeItem(`ph_${u}_${key}`);
        });
      });
      state.todos = [];
      state.notes = [];
      state.studyLogs = [];
      state.goals = [];
      state.schedule = [];
      renderAll();
      settingsModal.classList.add('hidden');
      alert('Đã dọn dẹp sạch toàn bộ dữ liệu rác! Bảng của bạn hiện tại mới 100%.');
    }
  });
}

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

// Initial Boot: Always show the Artistic Gateway Portal as default screen on startup
if (activeUser) {
  const isSun = activeUser === 'sun';
  const iconSvg = isSun ? ICON_GIRL_SVG : ICON_BOY_SVG;
  const label = document.getElementById('currentUserLabel');
  if (label) label.innerText = isSun ? 'Sun (P1)' : 'Icarus (P2)';
  const iconSpan = document.getElementById('currentUserIcon');
  if (iconSpan) iconSpan.innerHTML = iconSvg;
  const avatar = document.querySelector('.user-avatar');
  if (avatar) avatar.innerHTML = iconSvg;

  state.apiUrl = localStorage.getItem(getUserKey('api_url')) || localStorage.getItem('ph_shared_api_url') || '';
  state.todos = JSON.parse(localStorage.getItem(getUserKey('todos')) || '[]');
  state.notes = JSON.parse(localStorage.getItem(getUserKey('notes')) || '[]');
  state.studyLogs = JSON.parse(localStorage.getItem(getUserKey('study_logs')) || '[]');
  state.goals = JSON.parse(localStorage.getItem(getUserKey('goals')) || '[]');
  state.schedule = JSON.parse(localStorage.getItem(getUserKey('schedule')) || '[]');
  renderAll();
}
showWelcomePortal();
