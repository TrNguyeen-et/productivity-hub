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

// Chuẩn hoá định dạng thời gian HH:mm (xử lý triệt để chuỗi ISO từ Google Sheets: 1899-12-30T10:53:30.000Z)
function formatScheduleTime(val) {
  if (!val) return '08:00';
  const str = String(val).trim();

  // Dạng chuẩn HH:mm (VD: 08:00, 18:00)
  if (/^\d{2}:\d{2}$/.test(str)) {
    return str;
  }
  if (/^\d{1}:\d{2}$/.test(str)) {
    return '0' + str;
  }

  // Dạng chuỗi ISO hoặc Date từ Google Sheets (VD: 1899-12-30T10:53:30.000Z hoặc 1899-12-29T23:53:30.000Z)
  if (str.includes('T') || (str.includes('-') && str.length > 10)) {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      let totalMins = d.getHours() * 60 + d.getMinutes();
      if (d.getSeconds() >= 25 && d.getSeconds() <= 35) {
        totalMins = Math.round((totalMins * 60 + d.getSeconds()) / 60);
      }
      const h = String(Math.floor(totalMins / 60) % 24).padStart(2, '0');
      const m = String(totalMins % 60).padStart(2, '0');
      return `${h}:${m}`;
    }

    // Fallback regex nếu Date() parse lỗi trên trình duyệt cũ
    const tMatch = str.match(/T(\d{2}):(\d{2}):?(\d{2})?/);
    if (tMatch) {
      let utcH = parseInt(tMatch[1], 10);
      let utcM = parseInt(tMatch[2], 10);
      let utcS = tMatch[3] ? parseInt(tMatch[3], 10) : 0;
      let totalSec = utcH * 3600 + utcM * 60 + utcS + (7 * 3600 + 6 * 60 + 30);
      let roundedMin = Math.round(totalSec / 60);
      let h = String(Math.floor(roundedMin / 60) % 24).padStart(2, '0');
      let m = String(roundedMin % 60).padStart(2, '0');
      return `${h}:${m}`;
    }
  }

  // Nếu người dùng gõ số đơn giản: e.g. "8" -> "08:00", "18" -> "18:00"
  if (/^\d{1,2}$/.test(str)) {
    return str.padStart(2, '0') + ':00';
  }

  const match = str.match(/^(\d{1,2}):(\d{1,2})/);
  if (match) {
    return match[1].padStart(2, '0') + ':' + match[2].padStart(2, '0');
  }

  return str;
}

// Lấy ngày theo giờ địa phương (tránh lệch timezone UTC) dạng YYYY-MM-DD
function getLocalDateString(d = new Date()) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Chuẩn hoá ngày YYYY-MM-DD dùng cho biểu đồ Heatmap & khớp ngày
function formatLogDate(val) {
  if (!val) return '';
  const str = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const dmyMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmyMatch) {
    return `${dmyMatch[3]}-${dmyMatch[2].padStart(2, '0')}-${dmyMatch[1].padStart(2, '0')}`;
  }
  if (str.includes('T')) {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    return str.split('T')[0];
  }
  return str;
}

// Chuẩn hoá ngày hiển thị giao diện đẹp gọn: DD/MM/YYYY (Loại bỏ triệt để chuỗi 2026-11-14T17:00:00.000Z)
function formatDisplayDate(val) {
  if (!val) return '';
  const str = String(val).trim();

  // 1. Nếu đã là dạng DD/MM/YYYY
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(str)) {
    return str;
  }

  // 2. Dạng YYYY-MM-DD (VD: 2026-11-14)
  const ymdMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (ymdMatch) {
    return `${ymdMatch[3]}/${ymdMatch[2]}/${ymdMatch[1]}`;
  }

  // 3. Chuỗi ISO từ Google Sheets (VD: 2026-11-14T17:00:00.000Z)
  if (str.includes('T') || (str.includes('-') && str.length > 10)) {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    }

    // Fallback regex
    const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
    }
  }

  return str;
}

// Xử lý tiêu đề Ghi chú (Nếu bị dán nhầm chuỗi ISO ngày tháng từ Google Sheets)
function formatNoteTitle(title) {
  if (!title) return 'Ghi chú';
  const str = String(title).trim();
  if (str.includes('T') && str.length > 10 && !isNaN(new Date(str).getTime())) {
    return 'Ghi chú ngày ' + formatDisplayDate(str);
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    return 'Ghi chú ngày ' + formatDisplayDate(str);
  }
  return str;
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

// Tự động làm sạch dữ liệu Thời khóa biểu, Ghi chú & Lịch sử trong LocalStorage (loại bỏ triệt để chuỗi ISO cũ)
(function sanitizeAllStoredData() {
  const users = ['sun', 'icarus', 'default'];
  users.forEach(u => {
    // 1. Sanitize Notes
    const noteKey = `ph_${u}_notes`;
    try {
      const raw = JSON.parse(localStorage.getItem(noteKey) || '[]');
      if (Array.isArray(raw) && raw.length > 0) {
        const cleaned = raw.map(n => ({
          ...n,
          title: formatNoteTitle(n.title),
          updated_at: formatDisplayDate(n.updated_at)
        }));
        localStorage.setItem(noteKey, JSON.stringify(cleaned));
      }
    } catch(e) {}

    // 2. Sanitize Study Logs
    const logKey = `ph_${u}_study_logs`;
    try {
      const raw = JSON.parse(localStorage.getItem(logKey) || '[]');
      if (Array.isArray(raw) && raw.length > 0) {
        const cleaned = raw.map(l => ({
          ...l,
          date: formatDisplayDate(l.date)
        }));
        localStorage.setItem(logKey, JSON.stringify(cleaned));
      }
    } catch(e) {}

    // 3. Sanitize Schedule
    const key = `ph_${u}_schedule`;
    try {
      const raw = JSON.parse(localStorage.getItem(key) || '[]');
      if (Array.isArray(raw) && raw.length > 0) {
        let changed = false;
        const cleaned = raw.map(s => {
          const st = formatScheduleTime(s.start_time);
          const et = formatScheduleTime(s.end_time);
          if (st !== s.start_time || et !== s.end_time) changed = true;
          return { ...s, start_time: st, end_time: et };
        });
        if (changed) {
          localStorage.setItem(key, JSON.stringify(cleaned));
        }
      }
    } catch(e) {}
  });
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
  state.todos = JSON.parse(localStorage.getItem(getUserKey('todos')) || '[]').map(t => ({
    ...t,
    created_at: formatDisplayDate(t.created_at)
  }));
  state.notes = JSON.parse(localStorage.getItem(getUserKey('notes')) || '[]').map(n => ({
    ...n,
    title: formatNoteTitle(n.title),
    updated_at: formatDisplayDate(n.updated_at)
  }));
  state.studyLogs = JSON.parse(localStorage.getItem(getUserKey('study_logs')) || '[]').map(l => ({
    ...l,
    date: formatDisplayDate(l.date)
  }));
  state.goals = JSON.parse(localStorage.getItem(getUserKey('goals')) || '[]');
  const rawSchedule = JSON.parse(localStorage.getItem(getUserKey('schedule')) || '[]');
  state.schedule = rawSchedule.map(s => ({
    ...s,
    start_time: formatScheduleTime(s.start_time),
    end_time: formatScheduleTime(s.end_time)
  }));

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
        state.todos = json.data.Todos
          .filter(t => (!t.user || t.user === activeUser) && (!t.id || !t.id.startsWith('td_demo_')))
          .map(t => ({
            ...t,
            created_at: formatDisplayDate(t.created_at)
          }));
        saveToStorage('todos', state.todos);
      }
      if (json.data.Notes) {
        state.notes = json.data.Notes
          .filter(n => (!n.user || n.user === activeUser) && (!n.id || !n.id.startsWith('nt_demo_')))
          .map(n => ({
            ...n,
            title: formatNoteTitle(n.title),
            updated_at: formatDisplayDate(n.updated_at)
          }));
        saveToStorage('notes', state.notes);
      }
      if (json.data.StudyLogs) {
        state.studyLogs = json.data.StudyLogs
          .filter(l => (!l.user || l.user === activeUser) && (!l.id || !l.id.startsWith('lg_demo_')))
          .map(l => ({
            ...l,
            date: formatDisplayDate(l.date)
          }));
        saveToStorage('study_logs', state.studyLogs);
      }
      if (json.data.Schedule) {
        state.schedule = json.data.Schedule
          .filter(s => (!s.user || s.user === activeUser) && (!s.id || !['s1', 's2', 's3', 's4'].includes(s.id)))
          .map(s => ({
            ...s,
            start_time: formatScheduleTime(s.start_time),
            end_time: formatScheduleTime(s.end_time)
          }));
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

// Đồng bộ ngầm không hiện thông báo alert (dùng cho cập nhật thời gian thực tự động)
async function silentSyncFromSheet() {
  if (!state.apiUrl) return;
  try {
    const res = await fetch(state.apiUrl);
    const json = await res.json();
    if (json.status === 'success' && json.data) {
      if (json.data.Todos) {
        state.todos = json.data.Todos
          .filter(t => (!t.user || t.user === activeUser) && (!t.id || !t.id.startsWith('td_demo_')))
          .map(t => ({
            ...t,
            created_at: formatDisplayDate(t.created_at)
          }));
        saveToStorage('todos', state.todos);
      }
      if (json.data.Notes) {
        state.notes = json.data.Notes
          .filter(n => (!n.user || n.user === activeUser) && (!n.id || !n.id.startsWith('nt_demo_')))
          .map(n => ({
            ...n,
            title: formatNoteTitle(n.title),
            updated_at: formatDisplayDate(n.updated_at)
          }));
        saveToStorage('notes', state.notes);
      }
      if (json.data.StudyLogs) {
        state.studyLogs = json.data.StudyLogs
          .filter(l => (!l.user || l.user === activeUser) && (!l.id || !l.id.startsWith('lg_demo_')))
          .map(l => ({
            ...l,
            date: formatDisplayDate(l.date)
          }));
        saveToStorage('study_logs', state.studyLogs);
      }
      if (json.data.Schedule) {
        state.schedule = json.data.Schedule
          .filter(s => (!s.user || s.user === activeUser) && (!s.id || !['s1', 's2', 's3', 's4'].includes(s.id)))
          .map(s => ({
            ...s,
            start_time: formatScheduleTime(s.start_time),
            end_time: formatScheduleTime(s.end_time)
          }));
        saveToStorage('schedule', state.schedule);
      }
      if (json.data.Goals) {
        state.goals = json.data.Goals.filter(g => (!g.user || g.user === activeUser) && (!g.id || !['g1', 'g2'].includes(g.id)));
        saveToStorage('goals', state.goals);
      }
      renderAll();
      updateSyncUI('synced', 'Đã đồng bộ');
    }
  } catch (err) {
    // Không làm gián đoạn người dùng khi mất mạng thoáng qua
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
  window.scrollTo({ top: 0, behavior: 'smooth' });
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
  const todayStr = getLocalDateString();

  // 1. Study Hours KPI (chỉ tính phiên học hợp lệ, không tính phiên bỏ cuộc)
  const todayMinutes = state.studyLogs
    .filter(log => formatLogDate(log.date) === todayStr && !log.abandoned && Number(log.duration_minutes || 0) > 0)
    .reduce((sum, item) => sum + Number(item.duration_minutes || 0), 0);
  
  const studyHours = (todayMinutes / 60).toFixed(1);
  const elemStudyHours = document.getElementById('statStudyHours');
  if (elemStudyHours) elemStudyHours.innerText = studyHours;
  
  const targetStudyHours = 5.0;
  const activeStudySegments = Math.min(8, Math.round((parseFloat(studyHours) / targetStudyHours) * 8));
  const studyPct = Math.min(100, Math.round((parseFloat(studyHours) / targetStudyHours) * 100));
  const elemStudyPct = document.getElementById('kpiStudyPercent');
  if (elemStudyPct) elemStudyPct.innerText = `${studyPct}%`;
  
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
    const key = formatLogDate(log.date);
    activityMap[key] = (activityMap[key] || 0) + mins;
  });

  state.todos.forEach(todo => {
    if (todo.status === 'done') {
      const d = formatLogDate(todo.created_at) || today.toISOString().split('T')[0];
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
      .filter(l => formatLogDate(l.date) === dateStr && !l.abandoned && Number(l.duration_minutes || 0) > 0)
      .reduce((sum, l) => sum + Number(l.duration_minutes || 0), 0);

    // Completed tasks on this day
    const dayTasks = state.todos
      .filter(t => t.status === 'done' && (formatLogDate(t.completed_at) === dateStr || formatLogDate(t.created_at) === dateStr))
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
    const displayTitle = formatNoteTitle(note.title);
    const displayDate = formatDisplayDate(note.updated_at);
    card.innerHTML = `
      <div>
        <h3>${escapeHtml(displayTitle)}</h3>
        <p>${escapeHtml(note.content)}</p>
      </div>
      <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.75rem; color: #a1a1aa;">
        <span>${displayDate || ''}</span>
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
let pendingTotalSeconds = 0;

// iPad / Mobile Media Session (Thanh điều khiển Lock Screen & Chạy nền giống Spotify)
const silentAudio = new Audio(new URL('silent.wav', window.location.href).href);
silentAudio.loop = true;
silentAudio.volume = 1.0;
silentAudio.preload = 'auto';
silentAudio.setAttribute('playsinline', '');
silentAudio.setAttribute('webkit-playsinline', '');

// Web Audio API Keep-Alive (Dự phòng vững chắc cho iOS Safari khi tắt màn hình)
let audioCtx = null;
let oscillatorNode = null;
let gainNode = null;

function startWebAudioKeepAlive() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    if (!audioCtx) audioCtx = new AudioContextClass();
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    if (!oscillatorNode) {
      oscillatorNode = audioCtx.createOscillator();
      gainNode = audioCtx.createGain();
      gainNode.gain.setValueAtTime(0.0001, audioCtx.currentTime); // Âm lượng siêu nhỏ không gây ồn
      oscillatorNode.frequency.setValueAtTime(40, audioCtx.currentTime);
      oscillatorNode.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillatorNode.start();
    }
  } catch (e) {}
}

function stopWebAudioKeepAlive() {
  try {
    if (oscillatorNode) {
      oscillatorNode.stop();
      oscillatorNode.disconnect();
      oscillatorNode = null;
    }
  } catch (e) {}
}

function playSilentAudio() {
  startWebAudioKeepAlive();
  if (silentAudio) {
    silentAudio.play().then(() => {
      updateMediaSession();
      if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = 'playing';
      }
    }).catch(() => {});
  }
}

function pauseSilentAudio() {
  stopWebAudioKeepAlive();
  if (silentAudio) {
    silentAudio.pause();
  }
  if ('mediaSession' in navigator) {
    navigator.mediaSession.playbackState = 'paused';
  }
}

function stopSilentAudio() {
  stopWebAudioKeepAlive();
  if (silentAudio) {
    silentAudio.pause();
    silentAudio.currentTime = 0;
  }
  if ('mediaSession' in navigator) {
    navigator.mediaSession.playbackState = 'none';
  }
}

function updateMediaSession() {
  if (!('mediaSession' in navigator)) return;
  const modeName = timerMode === 'pomodoro' ? 'Pomodoro' : 'Tự học';
  const timeStr = timerDisplay ? timerDisplay.innerText : '00:00';
  const statusPrefix = timerRunning ? '▶ ' : '⏸ ';

  try {
    const iconUrl = new URL('favicon.png', window.location.href).href;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: `${statusPrefix}${modeName}: ${timeStr}`,
      artist: timerRunning ? 'I wanna be better (Đang đếm giờ)' : 'I wanna be better (Đang tạm dừng)',
      album: '⏸ Tạm dừng | ⏭ Kết thúc & Lưu | ⏮ Huỷ',
      artwork: [
        { src: iconUrl, sizes: '96x96', type: 'image/png' },
        { src: iconUrl, sizes: '192x192', type: 'image/png' },
        { src: iconUrl, sizes: '512x512', type: 'image/png' }
      ]
    });

    if ('playbackState' in navigator.mediaSession) {
      navigator.mediaSession.playbackState = timerRunning ? 'playing' : (timerMode === 'idle' ? 'none' : 'paused');
    }

    if ('setPositionState' in navigator.mediaSession) {
      if (timerMode === 'pomodoro') {
        const elapsed = Math.max(0, (25 * 60) - timerSeconds);
        navigator.mediaSession.setPositionState({
          duration: 25 * 60,
          playbackRate: timerRunning ? 1 : 0,
          position: Math.min(25 * 60, elapsed)
        });
      } else if (timerMode === 'stopwatch') {
        const totalSec = Math.max(1, (stopwatchAccumulatedSec || 0) + (lastResumeTimestamp ? Math.round((Date.now() - lastResumeTimestamp) / 1000) : 0));
        navigator.mediaSession.setPositionState({
          duration: Math.max(totalSec + 60, 3600),
          playbackRate: timerRunning ? 1 : 0,
          position: totalSec
        });
      }
    }
  } catch (e) {}
}

function finishSessionFromMediaControl() {
  if (timerMode === 'idle') return;

  clearInterval(timerInterval);
  timerInterval = null;

  let totalSec = 0;
  if (timerMode === 'stopwatch') {
    totalSec = stopwatchAccumulatedSec;
    if (timerRunning && lastResumeTimestamp) {
      totalSec += Math.round((Date.now() - lastResumeTimestamp) / 1000);
    }
  } else if (timerMode === 'pomodoro') {
    totalSec = 25 * 60;
  }

  timerRunning = false;
  lastResumeTimestamp = null;
  pauseSilentAudio();
  autoExitPip();

  if (totalSec < 5) {
    resetToIdle();
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification('✕ Đã huỷ phiên học', {
          body: 'Thời gian dưới 5 giây nên không lưu vào lịch sử.',
          icon: new URL('favicon.png', window.location.href).href
        });
      } catch (e) {}
    }
    return;
  }

  const duration = totalSec < 60 ? 1 : Math.max(1, Math.round(totalSec / 60));
  const now = new Date();
  const endTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const startTime = new Date(now.getTime() - duration * 60 * 1000);
  const startTimeStr = `${String(startTime.getHours()).padStart(2, '0')}:${String(startTime.getMinutes()).padStart(2, '0')}`;

  const subject = timerMode === 'pomodoro' ? 'Pomodoro' : 'Tự học (Màn hình khoá)';
  const notes = timerMode === 'pomodoro'
    ? 'Hoàn thành 25 phút Pomodoro từ màn hình khoá'
    : `Hoàn thành phiên ${duration} phút (${totalSec}s) từ điều khiển màn hình khoá`;

  const newLog = {
    id: 'lg_' + Date.now(),
    user: activeUser,
    subject,
    duration_minutes: duration,
    start_time: startTimeStr,
    end_time: endTimeStr,
    date: formatDisplayDate(new Date()),
    notes
  };

  state.studyLogs.unshift(newLog);
  saveToStorage('study_logs', state.studyLogs);
  renderStudyLogs();
  renderDashboard();
  sendToSheet('append', 'StudyLogs', { data: newLog });

  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification('🎉 Đã ghi nhận phiên học!', {
        body: `Tuyệt vời! Đã lưu: "${subject}" (${duration} phút, ${startTimeStr} – ${endTimeStr}) vào lịch sử.`,
        icon: new URL('favicon.png', window.location.href).href
      });
    } catch (e) {}
  }

  if ('mediaSession' in navigator) {
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: `✅ Đã lưu: ${duration} phút (${subject})`,
        artist: 'I wanna be better',
        album: 'Phiên học đã kết thúc và được lưu thành công',
        artwork: [
          { src: new URL('favicon.png', window.location.href).href, sizes: '192x192', type: 'image/png' }
        ]
      });
      navigator.mediaSession.playbackState = 'none';
    } catch (e) {}
  }

  resetToIdle();
}

function cancelSessionFromMediaControl() {
  resetToIdle();
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification('✕ Đã huỷ phiên học', {
        body: 'Phiên học đã được đặt lại về 00:00.',
        icon: new URL('favicon.png', window.location.href).href
      });
    } catch (e) {}
  }
}

function initMediaSessionHandlers() {
  if (!('mediaSession' in navigator)) return;

  const actionMap = {
    play: () => {
      if (!timerRunning && timerMode !== 'idle') {
        if (timerMode === 'stopwatch' && btnStopwatchPause) {
          btnStopwatchPause.click();
        } else {
          timerRunning = true;
          lastResumeTimestamp = Date.now();
          playSilentAudio();
          timerInterval = setInterval(tickTimer, 1000);
          updateTimerDisplay();
          updateMediaSession();
        }
      } else if (timerMode === 'idle' && btnStartStopwatch) {
        btnStartStopwatch.click();
      }
    },
    pause: () => {
      if (timerRunning) {
        if (timerMode === 'stopwatch' && btnStopwatchPause) {
          btnStopwatchPause.click();
        } else {
          clearInterval(timerInterval);
          timerRunning = false;
          if (lastResumeTimestamp) {
            stopwatchAccumulatedSec += Math.round((Date.now() - lastResumeTimestamp) / 1000);
            lastResumeTimestamp = null;
          }
          pauseSilentAudio();
          updateTimerDisplay();
          updateMediaSession();
        }
      }
    },
    stop: () => {
      finishSessionFromMediaControl();
    },
    nexttrack: () => {
      finishSessionFromMediaControl();
    },
    previoustrack: () => {
      cancelSessionFromMediaControl();
    },
    seekbackward: () => {
      if (timerMode === 'stopwatch' && btnStopwatchPause) btnStopwatchPause.click();
    },
    seekforward: () => {
      finishSessionFromMediaControl();
    }
  };

  for (const [action, handler] of Object.entries(actionMap)) {
    try {
      navigator.mediaSession.setActionHandler(action, handler);
    } catch (e) {}
  }
}
initMediaSessionHandlers();

async function requestBackgroundPermissions(showAlert = true) {
  let notifGranted = false;
  if ('Notification' in window) {
    try {
      const perm = await Notification.requestPermission();
      notifGranted = (perm === 'granted');
    } catch (e) {}
  }

  startWebAudioKeepAlive();

  try {
    if (silentAudio) {
      const playPromise = silentAudio.play();
      if (playPromise !== undefined) {
        await playPromise;
        if (!timerRunning) {
          silentAudio.pause();
        }
      }
    }
  } catch (e) {}

  updateMediaSession();

  const btn = document.getElementById('btnEnableIosBackground');
  const text = document.getElementById('bgModeStatusText');
  if (btn) btn.classList.add('active');
  if (text) text.innerText = 'Chạy nền';

  if (showAlert) {
    alert(`⚡ Tự động Chạy nền đã sẵn sàng!\n\nKhi bạn bấm "▶ Bắt đầu" hoặc "Pomodoro" rồi thoát ra ngoài (làm việc khác hoặc tắt màn hình):\n• Đồng hồ sẽ tự động đếm giờ ở chế độ chạy nền.\n• Thanh thông báo & Màn hình khóa sẽ tự động hiện thanh điều khiển để Tạm dừng, Tiếp tục hoặc Kết thúc & Lưu.`);
  }
}

function showBackgroundNotification() {
  if (!timerRunning) return;
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      const modeLabel = timerMode === 'pomodoro' ? 'Pomodoro' : 'Tự học';
      const timeStr = timerDisplay ? timerDisplay.innerText : '00:00';
      new Notification(`⏱ ${modeLabel}: ${timeStr} (Đang chạy nền)`, {
        body: 'Đang theo dõi thời gian học tập. Bấm để quay lại ứng dụng!',
        icon: new URL('favicon.png', window.location.href).href,
        tag: 'study-timer-running',
        renotify: false,
        silent: true
      });
    } catch (e) {}
  }
}

async function togglePictureInPicture() {
  initPipVideo();
  renderPipCanvas();

  if (document.pictureInPictureElement) {
    try {
      await document.exitPictureInPicture();
    } catch (e) {}
  } else {
    try {
      if (pipVideo) {
        await pipVideo.play();
        await pipVideo.requestPictureInPicture();
      }
    } catch (e) {
      alert('Chế độ Cửa sổ nổi (PiP) cần hỗ trợ của trình duyệt hoặc bạn đang dùng trên thiết bị không hỗ trợ PiP. Bạn có thể sử dụng chế độ Chạy nền & Màn hình khóa kiểu Spotify để đếm giờ khi tắt app!');
    }
  }
}

// Picture-in-Picture (Cửa sổ nổi tự động khi out trình duyệt) cho iPad / Điện thoại
let pipCanvas = null;
let pipCtx = null;
let pipVideo = null;

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
  pipVideo.setAttribute('playsinline', '');
  pipVideo.setAttribute('autoplay', '');
  pipVideo.setAttribute('muted', '');
  pipVideo.setAttribute('autopictureinpicture', '');
  pipVideo.autoPictureInPicture = true;
  pipVideo.style.position = 'fixed';
  pipVideo.style.bottom = '10px';
  pipVideo.style.right = '10px';
  pipVideo.style.width = '160px';
  pipVideo.style.height = '90px';
  pipVideo.style.opacity = '0.001';
  pipVideo.style.pointerEvents = 'none';
  pipVideo.style.zIndex = '-999';
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
  const label = timerMode === 'pomodoro' ? 'Pomodoro' : 'I wanna be better';
  pipCtx.fillText(label, pipCanvas.width / 2, pipCanvas.height / 2 + 50);
}

// Tự động mở PiP khi out trình duyệt
async function autoEnterPip() {
  if (!timerRunning) return;
  initPipVideo();
  renderPipCanvas();

  if (!document.pictureInPictureElement && pipVideo && pipVideo.requestPictureInPicture) {
    try {
      await pipVideo.play();
      await pipVideo.requestPictureInPicture();
    } catch (e) {
      // Browser auto PiP fallback
    }
  }
}

// Đóng PiP khi phiên học kết thúc
async function autoExitPip() {
  if (document.pictureInPictureElement) {
    try {
      await document.exitPictureInPicture();
    } catch (e) {}
  }
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
const btnEnableIosBackground = document.getElementById('btnEnableIosBackground');
const btnTogglePip = document.getElementById('btnTogglePip');
const btnPipActive = document.getElementById('btnPipActive');
const btnPipActivePomo = document.getElementById('btnPipActivePomo');

if (btnEnableIosBackground) {
  btnEnableIosBackground.addEventListener('click', () => requestBackgroundPermissions(true));
}
if (btnTogglePip) {
  btnTogglePip.addEventListener('click', togglePictureInPicture);
}
if (btnPipActive) {
  btnPipActive.addEventListener('click', togglePictureInPicture);
}
if (btnPipActivePomo) {
  btnPipActivePomo.addEventListener('click', togglePictureInPicture);
}

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
  pendingTotalSeconds = 0;

  stopSilentAudio();
  autoExitPip();
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
      autoExitPip();

      pendingTotalSeconds = 25 * 60;
      pendingElapsedMinutes = 25;

      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('🔔 Hoàn thành 25 phút Pomodoro!', {
          body: 'Tuyệt vời! Hãy ghi nhận nội dung bạn vừa học để lưu vào lịch sử.',
          icon: 'favicon.ico'
        });
      }

      // Mở modal để nhập môn học đã học trong 25 phút Pomodoro
      if (finishModalTitle) finishModalTitle.innerText = '🎉 Hoàn thành Pomodoro 25 phút!';
      if (finishModalDurationDesc) {
        finishModalDurationDesc.innerHTML = 'Chúc mừng bạn đã tập trung trọn vẹn: <strong>25 phút</strong>';
      }
      if (finishSubjectInput) {
        finishSubjectInput.value = '';
        finishSubjectInput.placeholder = 'Bạn vừa học môn/chủ đề gì trong 25 phút này?';
      }
      if (finishNotesInput) {
        finishNotesInput.value = '';
        finishNotesInput.placeholder = 'Ghi chú thêm về phiên học 25 phút này (tùy chọn)...';
      }
      if (finishSessionModal) {
        finishSessionModal.classList.remove('hidden');
        setTimeout(() => { if (finishSubjectInput) finishSubjectInput.focus(); }, 100);
      }
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
    requestBackgroundPermissions(false);
    playSilentAudio();

    // Khởi tạo video PiP sẵn sàng tự động bật khi out trình duyệt
    initPipVideo();
    renderPipCanvas();
    if (pipVideo) pipVideo.play().catch(() => {});

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

// Nút Kết thúc đếm xuôi -> Mở Modal ghi nhận môn học và ghi chú
if (btnStopwatchFinish) {
  btnStopwatchFinish.addEventListener('click', () => {
    // Dừng timer
    clearInterval(timerInterval);
    if (timerRunning && lastResumeTimestamp) {
      stopwatchAccumulatedSec += Math.round((Date.now() - lastResumeTimestamp) / 1000);
    }
    timerRunning = false;
    lastResumeTimestamp = null;
    pauseSilentAudio();
    autoExitPip();

    const totalSec = stopwatchAccumulatedSec || timerSeconds || 0;
    if (totalSec <= 0) {
      resetToIdle();
      return;
    }

    pendingTotalSeconds = totalSec;
    // Tự động tính số phút đã học (nếu dưới 60s tính là 1 phút)
    pendingElapsedMinutes = totalSec < 60 ? 1 : Math.max(1, Math.round(totalSec / 60));

    // Hiển thị modal để người dùng nhập môn học / chủ đề đã học
    if (finishModalTitle) finishModalTitle.innerText = '✨ Ghi nhận phiên học';
    if (finishModalDurationDesc) {
      const timeStr = totalSec < 60 ? `${pendingElapsedMinutes} phút (${totalSec}s)` : `${pendingElapsedMinutes} phút`;
      finishModalDurationDesc.innerHTML = `Khoảng thời gian đã học: <strong>${timeStr}</strong>`;
    }
    if (finishSubjectInput) {
      finishSubjectInput.value = '';
      finishSubjectInput.placeholder = 'VD: Toán giải tích, Lập trình React, Ôn từ vựng...';
    }
    if (finishNotesInput) {
      finishNotesInput.value = '';
      finishNotesInput.placeholder = totalSec < 60 ? `Tự học ${totalSec}s` : 'Ghi chú tóm tắt bài học, kết quả...';
    }
    if (finishSessionModal) {
      finishSessionModal.classList.remove('hidden');
      setTimeout(() => { if (finishSubjectInput) finishSubjectInput.focus(); }, 100);
    }
  });
}

// Nút Huỷ kết quả đếm xuôi -> Không lưu gì cả, trở về 00:00
if (btnStopwatchCancel) {
  btnStopwatchCancel.addEventListener('click', () => {
    resetToIdle();
  });
}

// 2. Chế độ POMODORO ĐẾM NGƯỢC 25m (Bấm "Pomodoro")
if (btnStartPomodoro) {
  btnStartPomodoro.addEventListener('click', () => {
    timerMode = 'pomodoro';
    timerSeconds = 25 * 60; // 1500s
    timerRunning = true;
    pomodoroTargetTimestamp = Date.now() + 25 * 60 * 1000;

    updateTimerDisplay();
    requestBackgroundPermissions(false);
    playSilentAudio();

    // Khởi tạo video PiP sẵn sàng tự động bật khi out trình duyệt
    initPipVideo();
    renderPipCanvas();
    if (pipVideo) pipVideo.play().catch(() => {});

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
  const defaultSubject = timerMode === 'pomodoro' ? 'Pomodoro' : 'Tự học';
  const defaultNotes = (pendingTotalSeconds && pendingTotalSeconds < 60)
    ? `Tự học ${pendingTotalSeconds}s`
    : (timerMode === 'pomodoro' ? 'Hoàn thành trọn vẹn 25 phút Pomodoro' : 'Hoàn thành phiên học');

  const subject = (finishSubjectInput?.value || '').trim() || defaultSubject;
  const notes = (finishNotesInput?.value || '').trim() || defaultNotes;
  const duration = pendingElapsedMinutes || 1;

  const now = new Date();
  const endTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const startTime = new Date(now.getTime() - duration * 60 * 1000);
  const startTimeStr = `${String(startTime.getHours()).padStart(2, '0')}:${String(startTime.getMinutes()).padStart(2, '0')}`;

  const newLog = {
    id: 'lg_' + Date.now(),
    user: activeUser,
    subject,
    duration_minutes: duration,
    start_time: startTimeStr,
    end_time: endTimeStr,
    date: formatDisplayDate(new Date()),
    notes
  };

  state.studyLogs.unshift(newLog);
  saveToStorage('study_logs', state.studyLogs);
  renderStudyLogs();
  renderDashboard();

  sendToSheet('append', 'StudyLogs', { data: newLog });

  if (finishSessionModal) finishSessionModal.classList.add('hidden');
  resetToIdle();
  alert(`🎉 Đã lưu phiên học: "${subject}" (${duration} phút, ${startTimeStr} – ${endTimeStr}) vào lịch sử!`);
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

if (finishSubjectInput) {
  finishSubjectInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveFinishSession();
    }
  });
}
if (finishNotesInput) {
  finishNotesInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveFinishSession();
    }
  });
}

// Xử lý Modal: Có việc gấp (Lưu lý do)
function saveUrgentSession() {
  const subject = (urgentSubjectInput?.value || '').trim() || 'Pomodoro';
  const reason = (urgentReasonInput?.value || '').trim() || 'Có việc gấp';
  const duration = pendingElapsedMinutes || 1;

  const now = new Date();
  const endTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const startTime = new Date(now.getTime() - duration * 60 * 1000);
  const startTimeStr = `${String(startTime.getHours()).padStart(2, '0')}:${String(startTime.getMinutes()).padStart(2, '0')}`;

  const newLog = {
    id: 'lg_' + Date.now(),
    user: activeUser,
    subject,
    duration_minutes: duration,
    has_urgent_reason: true,
    start_time: startTimeStr,
    end_time: endTimeStr,
    notes: reason,
    date: formatDisplayDate(new Date())
  };

  state.studyLogs.unshift(newLog);
  saveToStorage('study_logs', state.studyLogs);
  renderStudyLogs();
  renderDashboard();

  sendToSheet('append', 'StudyLogs', { data: newLog });

  if (urgentReasonModal) urgentReasonModal.classList.add('hidden');
  resetToIdle();
  alert(`Đã lưu phiên học: "${subject}" (${duration} phút, ${startTimeStr} – ${endTimeStr}) với lý do: "${reason}"!`);
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

// Tự động kích hoạt Chạy nền, Màn hình khóa & Cửa sổ nổi (PiP) khi out trình duyệt hoặc đổi app
document.addEventListener('visibilitychange', () => {
  if (timerRunning) {
    tickTimer();
    updateMediaSession();
    if (document.hidden) {
      autoEnterPip();
      showBackgroundNotification();
    }
  }
});

window.addEventListener('pagehide', () => {
  if (timerRunning) {
    updateMediaSession();
    autoEnterPip();
    showBackgroundNotification();
  }
});

window.addEventListener('blur', () => {
  if (timerRunning) {
    updateMediaSession();
    autoEnterPip();
    showBackgroundNotification();
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

  const countBadge = document.getElementById('historySessionCountBadge');
  if (countBadge) {
    countBadge.innerText = state.studyLogs.length > 0 ? `${state.studyLogs.length} phiên` : '0 phiên';
  }

  if (state.studyLogs.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; color: var(--text-muted); font-size: 0.88rem; padding: 3rem 1rem;">
        <div style="font-size: 2rem; margin-bottom: 0.75rem; opacity: 0.7;">⏳</div>
        <div>Chưa có phiên học nào được ghi nhận.</div>
        <div style="font-size: 0.8rem; margin-top: 0.35rem; opacity: 0.8;">Bắt đầu bấm giờ học hoặc chọn Pomodoro để lưu lại lịch sử!</div>
      </div>
    `;
    return;
  }

  state.studyLogs.slice(0, 15).forEach(log => {
    const item = document.createElement('div');
    item.className = `study-log-item ${log.abandoned ? 'abandoned-item' : ''}`;
    const interval = getLogTimeInterval(log);
    const timeIntervalStr = (!log.abandoned && interval.startTime && interval.endTime)
      ? ` (${interval.startTime} – ${interval.endTime})`
      : '';

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
          <div style="display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap;">
            <span style="color: #f59e0b; font-size: 0.95rem;">⚡</span>
            <strong>${escapeHtml(log.subject || 'Pomodoro')}</strong>
            <span style="font-size: 0.82rem; color: var(--text-muted);">· ${log.duration_minutes} phút${timeIntervalStr}</span>
          </div>
          <div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 2px;">
            Lý do: <em>${escapeHtml(log.notes || 'Có việc gấp')}</em>
          </div>
        </div>
      `;
    } else {
      mainHtml = `
        <div>
          <div style="display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap;">
            <strong>${escapeHtml(log.subject || 'Tự học')}</strong>
            <span style="font-size: 0.82rem; color: var(--text-muted);">· ${log.duration_minutes} phút${timeIntervalStr}</span>
          </div>
          ${log.notes ? `<div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 2px;">${escapeHtml(log.notes)}</div>` : ''}
        </div>
      `;
    }

    item.innerHTML = `
      ${mainHtml}
      <div style="display: flex; align-items: center; gap: 0.65rem;">
        <span class="log-date">${formatDisplayDate(log.date)}</span>
        <button class="btn-delete-study-log" data-id="${log.id}" title="Xoá phiên học này" style="background: none; border: none; cursor: pointer; color: var(--text-muted); font-size: 1.1rem; padding: 0 4px; border-radius: 4px; line-height: 1;">×</button>
      </div>
    `;

    container.appendChild(item);
  });
}

// -------------------------------------------------------------
// MODULE 4.1: 24-HOUR STUDY TIMELINE MODAL (CHI TIẾT 24H THEO NGÀY)
// -------------------------------------------------------------
let selectedTimelineDateStr = getLocalDateString(); // Mặc định là ngày hôm nay

const studyTimelineModal = document.getElementById('studyTimelineModal');
const btnOpenTimelineModal = document.getElementById('btnOpenTimelineModal');
const btnCloseTimelineModal = document.getElementById('btnCloseTimelineModal');
const btnCloseTimelineModalBottom = document.getElementById('btnCloseTimelineModalBottom');
const timelineDatePicker = document.getElementById('timelineDatePicker');
const btnTimelinePrevDay = document.getElementById('btnTimelinePrevDay');
const btnTimelineNextDay = document.getElementById('btnTimelineNextDay');

function getLogTimeInterval(log) {
  const durationMins = Number(log.duration_minutes || 0);

  // 1. Nếu đã có start_time và end_time:
  if (log.start_time && log.end_time && String(log.start_time).includes(':') && String(log.end_time).includes(':')) {
    const sParts = String(log.start_time).split(':').map(Number);
    const eParts = String(log.end_time).split(':').map(Number);
    const startMins = sParts[0] * 60 + sParts[1];
    let endMins = eParts[0] * 60 + eParts[1];
    if (endMins <= startMins) endMins = startMins + durationMins;
    return {
      startTime: formatScheduleTime(log.start_time),
      endTime: formatScheduleTime(log.end_time),
      startMins,
      endMins
    };
  }

  // 2. Trích xuất thời gian từ epoch id: "lg_1795139138486"
  let finishTimestamp = null;
  if (log.id && /^lg_\d{10,}$/.test(log.id)) {
    finishTimestamp = parseInt(log.id.replace('lg_', ''), 10);
  } else if (log.created_at && !isNaN(new Date(log.created_at).getTime())) {
    finishTimestamp = new Date(log.created_at).getTime();
  }

  if (finishTimestamp) {
    const finishDate = new Date(finishTimestamp);
    const startDate = new Date(finishTimestamp - durationMins * 60 * 1000);
    const sH = String(startDate.getHours()).padStart(2, '0');
    const sM = String(startDate.getMinutes()).padStart(2, '0');
    const fH = String(finishDate.getHours()).padStart(2, '0');
    const fM = String(finishDate.getMinutes()).padStart(2, '0');
    const startMins = startDate.getHours() * 60 + startDate.getMinutes();
    const endMins = finishDate.getHours() * 60 + finishDate.getMinutes();
    return {
      startTime: `${sH}:${sM}`,
      endTime: `${fH}:${fM}`,
      startMins,
      endMins: endMins > startMins ? endMins : startMins + durationMins
    };
  }

  // 3. Fallback slot hợp lý (ví dụ: 14:00 - 14:00 + duration)
  const defaultStart = 14 * 60;
  const defaultEnd = Math.min(1440, defaultStart + durationMins);
  const sH = String(Math.floor(defaultStart / 60)).padStart(2, '0');
  const sM = String(defaultStart % 60).padStart(2, '0');
  const fH = String(Math.floor(defaultEnd / 60)).padStart(2, '0');
  const fM = String(defaultEnd % 60).padStart(2, '0');
  return {
    startTime: `${sH}:${sM}`,
    endTime: `${fH}:${fM}`,
    startMins: defaultStart,
    endMins: defaultEnd
  };
}

function renderStudyTimeline() {
  const dParts = selectedTimelineDateStr.split('-').map(Number);
  const targetDate = new Date(dParts[0], dParts[1] - 1, dParts[2]);

  // Cập nhật date input & text hiển thị
  if (timelineDatePicker) timelineDatePicker.value = selectedTimelineDateStr;
  
  const todayStr = getLocalDateString();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = getLocalDateString(yesterday);
  const dayBefore = new Date();
  dayBefore.setDate(dayBefore.getDate() - 2);
  const dayBeforeStr = getLocalDateString(dayBefore);

  let relativeDay = '';
  if (selectedTimelineDateStr === todayStr) relativeDay = ' (Hôm nay)';
  else if (selectedTimelineDateStr === yesterdayStr) relativeDay = ' (Hôm qua)';
  else if (selectedTimelineDateStr === dayBeforeStr) relativeDay = ' (Ngày kia)';

  const dayNames = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
  const dayOfWeek = dayNames[targetDate.getDay()];
  const formattedDateVN = `${dayOfWeek}, ${String(targetDate.getDate()).padStart(2, '0')}/${String(targetDate.getMonth() + 1).padStart(2, '0')}/${targetDate.getFullYear()}`;

  const labelElem = document.getElementById('timelineSelectedDateText');
  if (labelElem) labelElem.innerText = `${formattedDateVN}${relativeDay}`;

  // Active state quick pills
  document.querySelectorAll('.timeline-quick-pill').forEach(pill => {
    const offset = parseInt(pill.dataset.offset, 10);
    const d = new Date();
    d.setDate(d.getDate() + offset);
    pill.classList.toggle('active', getLocalDateString(d) === selectedTimelineDateStr);
  });

  // Lọc các phiên học của ngày này
  const dayLogs = state.studyLogs.filter(log => {
    if (log.abandoned) return false;
    const logDateStr = formatLogDate(log.date);
    return logDateStr === selectedTimelineDateStr && Number(log.duration_minutes || 0) > 0;
  });

  const totalMinutes = dayLogs.reduce((sum, l) => sum + Number(l.duration_minutes || 0), 0);
  const totalHours = (totalMinutes / 60).toFixed(1);

  const hoursTextElem = document.getElementById('timelineTotalHoursText');
  if (hoursTextElem) hoursTextElem.innerText = `${totalHours} giờ (${totalMinutes} phút)`;

  const countTextElem = document.getElementById('timelineSessionCountText');
  if (countTextElem) countTextElem.innerText = `${dayLogs.length} phiên học`;

  // 1. RENDER 24H CONTINUOUS TRACK
  const track = document.getElementById('timeline24hTrack');
  if (track) {
    track.innerHTML = '';
    dayLogs.forEach(log => {
      const interval = getLogTimeInterval(log);
      const leftPct = Math.max(0, Math.min(100, (interval.startMins / 1440) * 100));
      const widthPct = Math.max(0.8, Math.min(100 - leftPct, ((interval.endMins - interval.startMins) / 1440) * 100));

      const block = document.createElement('div');
      block.className = 'timeline-session-block';
      block.style.left = `${leftPct}%`;
      block.style.width = `${widthPct}%`;
      block.title = `${log.subject}: ${interval.startTime} – ${interval.endTime} (${log.duration_minutes} phút)`;
      track.appendChild(block);
    });
  }

  // 2. RENDER 24-HOUR BLOCK GRID (0h - 23h)
  const grid = document.getElementById('timeline24hGrid');
  if (grid) {
    grid.innerHTML = '';
    for (let h = 0; h < 24; h++) {
      const hStart = h * 60;
      const hEnd = (h + 1) * 60;

      // Tính tổng phút đã học trong khung giờ này
      let hourStudiedMins = 0;
      const studiedSubjects = [];

      dayLogs.forEach(log => {
        const interval = getLogTimeInterval(log);
        const overlapStart = Math.max(hStart, interval.startMins);
        const overlapEnd = Math.min(hEnd, interval.endMins);
        if (overlapEnd > overlapStart) {
          hourStudiedMins += (overlapEnd - overlapStart);
          if (!studiedSubjects.includes(log.subject)) studiedSubjects.push(log.subject);
        }
      });

      const slot = document.createElement('div');
      const isStudied = hourStudiedMins > 0;
      slot.className = `timeline-hour-slot ${isStudied ? 'studied-hour' : ''}`;

      const hLabel = `${String(h).padStart(2, '0')}:00`;
      const nextHLabel = `${String((h + 1) % 24).padStart(2, '0')}:00`;

      slot.innerHTML = `
        <div class="hour-time">${hLabel}</div>
        <div class="hour-stat">${isStudied ? `${hourStudiedMins}m` : '-'}</div>
      `;
      if (isStudied) {
        slot.title = `${hLabel} – ${nextHLabel}: Học ${hourStudiedMins} phút (${studiedSubjects.join(', ')})`;
      } else {
        slot.title = `${hLabel} – ${nextHLabel}: Không có hoạt động`;
      }
      grid.appendChild(slot);
    }
  }

  // 3. RENDER SESSIONS LIST
  const list = document.getElementById('timelineSessionsList');
  if (list) {
    list.innerHTML = '';
    if (dayLogs.length === 0) {
      list.innerHTML = `
        <div style="text-align: center; color: var(--text-muted); font-size: 0.85rem; padding: 1.5rem 0.5rem;">
          ☕ Ngày này bạn chưa có phiên học nào được ghi nhận.
        </div>
      `;
    } else {
      dayLogs.forEach(log => {
        const interval = getLogTimeInterval(log);
        const item = document.createElement('div');
        item.className = 'timeline-session-item';
        item.innerHTML = `
          <div>
            <div class="session-title">${escapeHtml(log.subject || 'Tự học')}</div>
            <div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 0.2rem;">
              ${escapeHtml(log.notes || 'Hoàn thành phiên học')}
            </div>
          </div>
          <div style="text-align: right;">
            <div class="session-time">${interval.startTime} – ${interval.endTime}</div>
            <div style="font-size: 0.76rem; color: var(--text-muted); margin-top: 0.2rem;">
              <strong>${log.duration_minutes} phút</strong>
            </div>
          </div>
        `;
        list.appendChild(item);
      });
    }
  }
}

if (btnOpenTimelineModal) {
  btnOpenTimelineModal.addEventListener('click', () => {
    selectedTimelineDateStr = getLocalDateString();
    renderStudyTimeline();
    if (studyTimelineModal) studyTimelineModal.classList.remove('hidden');
  });
}

const cardKpiStudyElem = document.getElementById('cardKpiStudy');
if (cardKpiStudyElem) {
  cardKpiStudyElem.addEventListener('click', () => {
    if (btnOpenTimelineModal) {
      btnOpenTimelineModal.click();
    } else {
      selectedTimelineDateStr = getLocalDateString();
      renderStudyTimeline();
      if (studyTimelineModal) studyTimelineModal.classList.remove('hidden');
    }
  });
}

if (btnCloseTimelineModal) {
  btnCloseTimelineModal.addEventListener('click', () => {
    if (studyTimelineModal) studyTimelineModal.classList.add('hidden');
  });
}
if (btnCloseTimelineModalBottom) {
  btnCloseTimelineModalBottom.addEventListener('click', () => {
    if (studyTimelineModal) studyTimelineModal.classList.add('hidden');
  });
}

if (timelineDatePicker) {
  timelineDatePicker.addEventListener('change', (e) => {
    if (e.target.value) {
      selectedTimelineDateStr = e.target.value;
      renderStudyTimeline();
    }
  });
}

if (btnTimelinePrevDay) {
  btnTimelinePrevDay.addEventListener('click', () => {
    const dParts = selectedTimelineDateStr.split('-').map(Number);
    const d = new Date(dParts[0], dParts[1] - 1, dParts[2]);
    d.setDate(d.getDate() - 1);
    selectedTimelineDateStr = getLocalDateString(d);
    renderStudyTimeline();
  });
}

if (btnTimelineNextDay) {
  btnTimelineNextDay.addEventListener('click', () => {
    const dParts = selectedTimelineDateStr.split('-').map(Number);
    const d = new Date(dParts[0], dParts[1] - 1, dParts[2]);
    d.setDate(d.getDate() + 1);
    selectedTimelineDateStr = getLocalDateString(d);
    renderStudyTimeline();
  });
}

document.querySelectorAll('.timeline-quick-pill').forEach(pill => {
  pill.addEventListener('click', () => {
    const offset = parseInt(pill.dataset.offset, 10);
    const d = new Date();
    d.setDate(d.getDate() + offset);
    selectedTimelineDateStr = getLocalDateString(d);
    renderStudyTimeline();
  });
});

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
// MODULE 5: SCHEDULE (THỜI KHÓA BIỂU & ĐIỀU HƯỚNG TUẦN THỜI GIAN THỰC)
// -------------------------------------------------------------
const scheduleForm = document.getElementById('scheduleForm');
const scheduleFormTitle = document.getElementById('scheduleFormTitle');
const btnCloseScheduleForm = document.getElementById('btnCloseScheduleForm');
const btnAddSchedule = document.getElementById('btnAddSchedule');
const btnCancelSchedule = document.getElementById('btnCancelSchedule');
const btnSaveSchedule = document.getElementById('btnSaveSchedule');
const btnPrevWeek = document.getElementById('btnPrevWeek');
const btnCurrentWeek = document.getElementById('btnCurrentWeek');
const btnNextWeek = document.getElementById('btnNextWeek');

let editingScheduleId = null;
let currentScheduleWeekOffset = 0; // 0: Tuần này, -1: Tuần trước, +1: Tuần sau

// Tính toán chi tiết tuần theo thời gian thực (Bắt đầu từ tuần hiện tại)
function getScheduleWeekDetails(offset = 0) {
  const now = new Date();
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0: Chủ nhật, 1: Thứ 2, ... 6: Thứ 7

  // Mốc tuần: Nếu hôm nay là Chủ nhật (0), tính chu kỳ tuần mục tiêu bắt đầu từ Thứ 2 tiếp theo
  // Khớp chính xác yêu cầu người dùng: 'như là tuần này là 15/11/2026 -> 22/11/2026'
  const diffToMonday = day === 0 ? 1 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday + (offset * 7));

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const pad = n => String(n).padStart(2, '0');
  const fmt = dt => pad(dt.getDate()) + '/' + pad(dt.getMonth() + 1) + '/' + dt.getFullYear();
  const fmtShort = dt => pad(dt.getDate()) + '/' + pad(dt.getMonth() + 1);

  // Nhãn tuần: Nếu là tuần này và hôm nay là CN (15/11), hiển thị 15/11/2026 – 22/11/2026
  let startLabel = fmt(monday);
  if (day === 0 && offset === 0) {
    startLabel = fmt(d);
  }
  const label = `${startLabel} – ${fmt(sunday)}`;

  const days = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];
  const dayList = days.map((name, i) => {
    const cur = new Date(monday);
    cur.setDate(monday.getDate() + i);
    return {
      day: name,
      dateShort: fmtShort(cur),
      dateFull: fmt(cur),
      isToday: cur.toDateString() === now.toDateString()
    };
  });

  const weekYear = monday.getFullYear();
  const firstJan = new Date(weekYear, 0, 1);
  const weekNo = Math.ceil((((monday - firstJan) / 86400000) + firstJan.getDay() + 1) / 7);
  const weekKey = `${weekYear}-W${pad(weekNo)}`;

  let statusText = 'Tuần này';
  let statusClass = 'week-status-current';
  if (offset < 0) {
    statusText = 'Quá khứ (Đã qua)';
    statusClass = 'week-status-past';
  } else if (offset > 0) {
    statusText = 'Tuần sau';
    statusClass = 'week-status-future';
  }

  return {
    monday,
    sunday,
    offset,
    label,
    statusText,
    statusClass,
    dayList,
    weekKey,
    isPast: offset < 0
  };
}

function resetScheduleForm() {
  editingScheduleId = null;
  if (scheduleFormTitle) scheduleFormTitle.innerText = '+ Thêm khung giờ mới';
  if (btnSaveSchedule) btnSaveSchedule.innerText = 'Lưu vào lịch';
  document.getElementById('schedActivity').value = '';
  document.getElementById('schedStart').value = '08:00';
  document.getElementById('schedEnd').value = '10:00';
  document.getElementById('schedType').value = 'Học';
  const repeatBox = document.getElementById('schedRepeat');
  if (repeatBox) repeatBox.checked = true;
  if (scheduleForm) scheduleForm.classList.add('hidden');
}

if (btnAddSchedule) {
  btnAddSchedule.addEventListener('click', () => {
    const weekInfo = getScheduleWeekDetails(currentScheduleWeekOffset);
    if (weekInfo.isPast) {
      alert('Tuần này thuộc quá khứ nên lịch rảnh đã bị khóa. Bạn chỉ có thể thêm TKB cố định hoặc chuyển sang tuần hiện tại / tương lai.');
    }
    resetScheduleForm();
    if (scheduleForm) scheduleForm.classList.remove('hidden');
    document.getElementById('schedActivity').focus();
  });
}

if (btnCancelSchedule) {
  btnCancelSchedule.addEventListener('click', resetScheduleForm);
}

if (btnCloseScheduleForm) {
  btnCloseScheduleForm.addEventListener('click', resetScheduleForm);
}

// Bắt sự kiện chuyển tuần (Tuần trước, Tuần này, Tuần sau)
if (btnPrevWeek) {
  btnPrevWeek.addEventListener('click', () => {
    currentScheduleWeekOffset--;
    renderSchedule();
  });
}
if (btnCurrentWeek) {
  btnCurrentWeek.addEventListener('click', () => {
    currentScheduleWeekOffset = 0;
    renderSchedule();
  });
}
if (btnNextWeek) {
  btnNextWeek.addEventListener('click', () => {
    currentScheduleWeekOffset++;
    renderSchedule();
  });
}

const schedStartInput = document.getElementById('schedStart');
const schedEndInput = document.getElementById('schedEnd');
if (schedStartInput) {
  schedStartInput.addEventListener('blur', () => {
    schedStartInput.value = formatScheduleTime(schedStartInput.value);
  });
}
if (schedEndInput) {
  schedEndInput.addEventListener('blur', () => {
    schedEndInput.value = formatScheduleTime(schedEndInput.value);
  });
}

const schedTypeInput = document.getElementById('schedType');
if (schedTypeInput) {
  schedTypeInput.addEventListener('change', () => {
    const repeatBox = document.getElementById('schedRepeat');
    if (repeatBox) {
      // Giờ học thường lặp hàng tuần, giờ rảnh thường cho tuần cụ thể
      repeatBox.checked = (schedTypeInput.value === 'Học');
    }
  });
}

if (btnSaveSchedule) {
  btnSaveSchedule.addEventListener('click', () => {
    const day = document.getElementById('schedDay').value;
    const start_time = formatScheduleTime(document.getElementById('schedStart').value);
    const end_time = formatScheduleTime(document.getElementById('schedEnd').value);
    const type = document.getElementById('schedType').value;
    const activity = document.getElementById('schedActivity').value.trim() || (type === 'Học' ? 'Buổi học' : 'Thời gian rảnh');
    const repeat = document.getElementById('schedRepeat')?.checked ?? (type === 'Học');

    const weekInfo = getScheduleWeekDetails(currentScheduleWeekOffset);

    // Kiểm tra khóa: Nếu ở tuần cũ và chọn giờ Rảnh -> Không cho thêm
    if (weekInfo.isPast && type === 'Rảnh') {
      alert('Không thể thêm hoặc sửa lịch rảnh vào tuần trong quá khứ vì lịch tuần cũ đã bị khóa!');
      return;
    }

    const week_key = repeat ? 'all' : weekInfo.weekKey;

    if (editingScheduleId) {
      // 1. Cập nhật khung giờ đã có (Sửa)
      const index = state.schedule.findIndex(s => s.id === editingScheduleId);
      if (index !== -1) {
        state.schedule[index] = {
          ...state.schedule[index],
          day,
          start_time,
          end_time,
          type,
          activity,
          week_key
        };
        saveToStorage('schedule', state.schedule);
        renderSchedule();
        sendToSheet('update', 'Schedule', { id: editingScheduleId, data: state.schedule[index] });
      }
    } else {
      // 2. Thêm khung giờ mới
      const newSlot = {
        id: 'sc_' + Date.now(),
        user: activeUser,
        day,
        start_time,
        end_time,
        activity,
        type,
        week_key
      };

      state.schedule.push(newSlot);
      saveToStorage('schedule', state.schedule);
      renderSchedule();
      sendToSheet('append', 'Schedule', { data: newSlot });
    }

    resetScheduleForm();
  });
}

function renderSchedule() {
  const weekInfo = getScheduleWeekDetails(currentScheduleWeekOffset);

  // 1. Cập nhật nhãn tuần & trạng thái hiển thị
  const weekLabelElem = document.getElementById('schedWeekRangeLabel');
  if (weekLabelElem) weekLabelElem.innerText = weekInfo.label;

  const statusTagElem = document.getElementById('schedWeekStatusTag');
  if (statusTagElem) {
    statusTagElem.innerText = weekInfo.statusText;
    statusTagElem.className = `week-status-pill ${weekInfo.statusClass}`;
  }

  // Active state nút Tuần này
  if (btnCurrentWeek) {
    if (currentScheduleWeekOffset === 0) {
      btnCurrentWeek.classList.add('active-current');
    } else {
      btnCurrentWeek.classList.remove('active-current');
    }
  }

  // 2. Render từng ngày Thứ 2 -> Chủ nhật
  weekInfo.dayList.forEach(dayItem => {
    const day = dayItem.day;
    const col = document.querySelector(`.day-slot-card[data-day="${day}"] .day-slots`);
    const card = document.querySelector(`.day-slot-card[data-day="${day}"]`);
    if (!col || !card) return;

    // Cập nhật tiêu đề ngày có ngày tháng thực tế: Thứ 2 (16/11)
    const h3 = card.querySelector('h3');
    if (h3) {
      h3.innerHTML = `${day} <span class="day-date-sub">(${dayItem.dateShort})</span>`;
    }

    if (dayItem.isToday && currentScheduleWeekOffset === 0) {
      card.classList.add('is-today');
      if (window.innerWidth <= 768) {
        setTimeout(() => {
          card.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        }, 120);
      }
    } else {
      card.classList.remove('is-today');
    }

    col.innerHTML = '';

    // Lọc các khung giờ của ngày này
    const slots = state.schedule.filter(s => {
      if (s.day !== day) return false;
      // Nếu slot có week_key cụ thể thì phải khớp tuần đang xem
      if (s.week_key && s.week_key !== 'all') {
        return s.week_key === weekInfo.weekKey;
      }
      // Khung giờ lặp hoặc chưa gán week_key hiển thị ở mọi tuần
      return true;
    });

    slots.sort((a, b) => formatScheduleTime(a.start_time).localeCompare(formatScheduleTime(b.start_time)));

    slots.forEach(slot => {
      const startTime = formatScheduleTime(slot.start_time);
      const endTime = formatScheduleTime(slot.end_time);
      const div = document.createElement('div');
      div.className = `sched-slot type-${slot.type}`;
      div.setAttribute('data-id', slot.id);

      // QUY TẮC KHÓA: Nếu là tuần quá khứ (offset < 0) và loại là 'Rảnh' => KHÓA HOÀN TOÀN
      const isLocked = weekInfo.isPast && slot.type === 'Rảnh';

      let actionHtml = '';
      if (isLocked) {
        actionHtml = `<span class="badge-locked" title="Lịch rảnh của tuần cũ đã kết thúc và bị khóa tự động">🔒 Đã khóa</span>`;
      } else {
        actionHtml = `
          <div class="sched-slot-actions">
            <button class="btn-sched-edit" data-id="${slot.id}" title="Sửa khung giờ">✏️</button>
            <button class="btn-sched-del" data-id="${slot.id}" title="Xoá khung giờ">🗑️</button>
          </div>
        `;
      }

      div.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 4px;">
          <span style="font-weight: 700; font-size: 0.75rem;">${startTime} - ${endTime}</span>
          ${actionHtml}
        </div>
        <div class="sched-activity-text">${escapeHtml(slot.activity)}</div>
      `;
      col.appendChild(div);
    });
  });
}

// Bắt sự kiện Sửa và Xoá khung giờ trên lưới thời khóa biểu
const daysGridContainer = document.querySelector('.stylish-days-grid');
if (daysGridContainer) {
  daysGridContainer.addEventListener('click', (e) => {
    const weekInfo = getScheduleWeekDetails(currentScheduleWeekOffset);

    // 1. Nút Sửa khung giờ
    const editBtn = e.target.closest('.btn-sched-edit');
    if (editBtn) {
      const id = editBtn.dataset.id;
      const slot = state.schedule.find(s => s.id === id);
      if (!slot) return;

      // Bảo vệ: Nếu lịch rảnh ở tuần quá khứ thì không cho sửa
      if (weekInfo.isPast && slot.type === 'Rảnh') {
        alert('Lịch rảnh của tuần cũ đã bị khóa, không thể chỉnh sửa!');
        return;
      }

      editingScheduleId = id;
      document.getElementById('schedDay').value = slot.day;
      document.getElementById('schedStart').value = formatScheduleTime(slot.start_time);
      document.getElementById('schedEnd').value = formatScheduleTime(slot.end_time);
      document.getElementById('schedType').value = slot.type;
      document.getElementById('schedActivity').value = slot.activity;

      const repeatBox = document.getElementById('schedRepeat');
      if (repeatBox) {
        repeatBox.checked = (!slot.week_key || slot.week_key === 'all');
      }

      if (scheduleFormTitle) scheduleFormTitle.innerText = '✏️ Sửa khung giờ';
      if (btnSaveSchedule) btnSaveSchedule.innerText = 'Lưu thay đổi';

      if (scheduleForm) {
        scheduleForm.classList.remove('hidden');
        scheduleForm.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
      document.getElementById('schedActivity').focus();
      return;
    }

    // 2. Nút Xoá khung giờ
    const delBtn = e.target.closest('.btn-sched-del');
    if (delBtn) {
      const id = delBtn.dataset.id;
      const slot = state.schedule.find(s => s.id === id);
      if (!slot) return;

      // Bảo vệ: Nếu lịch rảnh ở tuần quá khứ thì không cho xóa
      if (weekInfo.isPast && slot.type === 'Rảnh') {
        alert('Lịch rảnh của tuần cũ đã bị khóa, không thể xóa!');
        return;
      }

      const slotDesc = slot ? `"${slot.activity}" (${slot.day} ${formatScheduleTime(slot.start_time)}-${formatScheduleTime(slot.end_time)})` : 'khung giờ này';
      if (confirm(`Bạn có chắc muốn xoá ${slotDesc}?`)) {
        state.schedule = state.schedule.filter(s => s.id !== id);
        saveToStorage('schedule', state.schedule);
        renderSchedule();
        sendToSheet('delete', 'Schedule', { id });
      }
      return;
    }
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
  state.todos = JSON.parse(localStorage.getItem(getUserKey('todos')) || '[]').map(t => ({
    ...t,
    created_at: formatDisplayDate(t.created_at)
  }));
  state.notes = JSON.parse(localStorage.getItem(getUserKey('notes')) || '[]').map(n => ({
    ...n,
    title: formatNoteTitle(n.title),
    updated_at: formatDisplayDate(n.updated_at)
  }));
  state.studyLogs = JSON.parse(localStorage.getItem(getUserKey('study_logs')) || '[]').map(l => ({
    ...l,
    date: formatDisplayDate(l.date)
  }));
  state.goals = JSON.parse(localStorage.getItem(getUserKey('goals')) || '[]');
  const rawSchedule = JSON.parse(localStorage.getItem(getUserKey('schedule')) || '[]');
  state.schedule = rawSchedule.map(s => ({
    ...s,
    start_time: formatScheduleTime(s.start_time),
    end_time: formatScheduleTime(s.end_time)
  }));
  renderAll();
}
showWelcomePortal();

// -------------------------------------------------------------
// MODULE 5: REAL-TIME CONTINUOUS BACKGROUND UPDATE TICKER
// -------------------------------------------------------------
// Tự động cập nhật giao diện theo thời gian thực và đồng bộ Sheet mỗi 45 giây
setInterval(() => {
  renderDashboard();
  renderSchedule();
  if (state.apiUrl) {
    silentSyncFromSheet();
  }
}, 45000);

// Đồng bộ và làm mới ngay khi người dùng chuyển lại tab trình duyệt
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    renderDashboard();
    renderSchedule();
    if (state.apiUrl) {
      silentSyncFromSheet();
    }
  }
});

// Bấm vào nhãn trạng thái đồng bộ (#syncBadge) để đồng bộ ngay lập tức
const syncBadgeElem = document.getElementById('syncBadge');
if (syncBadgeElem) {
  syncBadgeElem.style.cursor = 'pointer';
  syncBadgeElem.title = 'Bấm để đồng bộ dữ liệu ngay lập tức với Google Sheets';
  syncBadgeElem.addEventListener('click', () => {
    fetchAllFromSheet();
  });
}
