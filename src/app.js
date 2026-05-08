const STORAGE_KEY = "minimal-plan-board-v1";
const dayNames = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
const calendarColors = ["orange", "green", "blue", "pink", "yellow"];
const state = loadState();

let viewedMonday = startOfWeek(new Date());
let selectedDate = toKey(new Date());
let currentView = "board";
let viewedMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
let calendarSelectedDate = selectedDate;
let sorting = null;
let openTaskColorPicker = null;
let suppressDragClick = false;

const periodTitle = document.getElementById("periodTitle");
const daysEl = document.getElementById("days");
const boardEl = document.getElementById("board");
const monthView = document.getElementById("monthView");
const monthToggle = document.getElementById("monthToggle");
const calendarWeekdays = document.getElementById("calendarWeekdays");
const calendarGrid = document.getElementById("calendarGrid");
const dayDetailTitle = document.getElementById("dayDetailTitle");
const dayDetailCount = document.getElementById("dayDetailCount");
const dayDetailList = document.getElementById("dayDetailList");
const dayColorPicker = document.getElementById("dayColorPicker");
const jumpToSelectedDay = document.getElementById("jumpToSelectedDay");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const zones = {
  weekTodo: document.querySelector('[data-list="weekTodo"]'),
  weekDone: document.querySelector('[data-list="weekDone"]'),
  dayTodo: document.querySelector('[data-list="dayTodo"]'),
  dayDone: document.querySelector('[data-list="dayDone"]')
};

prevBtn.addEventListener("click", () => shiftPeriod(-1));
nextBtn.addEventListener("click", () => shiftPeriod(1));
monthToggle.addEventListener("click", toggleMonthView);
jumpToSelectedDay.addEventListener("click", () => jumpToDay(calendarSelectedDate));
document.addEventListener("click", (event) => {
  if (!event.target.closest(".task-color-picker") && !event.target.closest(".drag-btn")) {
    closeTaskColorPicker();
  }
});

Object.entries(zones).forEach(([type, zone]) => {
  const form = zone.querySelector(".quick-add");
  if (!form || !form.querySelector("input")) return;
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const input = form.querySelector("input");
    addTask(type, input.value);
    input.value = "";
  });
});

render();

function loadState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (parsed && typeof parsed === "object") {
      if (!parsed.weeks) parsed.weeks = {};
      if (!parsed.days) parsed.days = {};
      if (!parsed.dayColors) parsed.dayColors = {};
      return parsed;
    }
  } catch (error) {
    console.warn("计划表数据读取失败", error);
  }
  return { weeks: {}, days: {}, dayColors: {} };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function ensureWeek(key) {
  if (!state.weeks[key]) state.weeks[key] = { todo: [], done: [] };
  return state.weeks[key];
}

function ensureDay(key) {
  if (!state.days[key]) state.days[key] = { todo: [], done: [] };
  return state.days[key];
}

function currentData(type) {
  const weekKey = toKey(viewedMonday);
  if (type === "weekTodo") return ensureWeek(weekKey).todo;
  if (type === "weekDone") return ensureWeek(weekKey).done;
  if (type === "dayTodo") return ensureDay(selectedDate).todo;
  return ensureDay(selectedDate).done;
}

function render() {
  if (currentView === "month") {
    boardEl.classList.add("hidden");
    monthView.classList.remove("hidden");
    daysEl.classList.add("hidden");
    periodTitle.textContent = `${viewedMonth.getFullYear()}年${viewedMonth.getMonth() + 1}月`;
    monthToggle.textContent = "▤";
    monthToggle.title = "四区间";
    monthToggle.setAttribute("aria-label", "四区间");
    prevBtn.title = "上一月";
    nextBtn.title = "下一月";
    renderMonth();
    saveState();
    return;
  }

  boardEl.classList.remove("hidden");
  monthView.classList.add("hidden");
  daysEl.classList.remove("hidden");
  monthToggle.textContent = "▦";
  monthToggle.title = "月日历";
  monthToggle.setAttribute("aria-label", "月日历");
  prevBtn.title = "上一周";
  nextBtn.title = "下一周";

  const weekStart = new Date(viewedMonday);
  const weekEnd = addDays(weekStart, 6);
  periodTitle.textContent = `${formatDate(weekStart)} - ${formatDate(weekEnd)}`;
  renderDays();
  renderList("weekTodo");
  renderList("weekDone");
  renderList("dayTodo");
  renderList("dayDone");
  saveState();
}

function renderDays() {
  daysEl.innerHTML = "";
  for (let index = 0; index < 7; index += 1) {
    const date = addDays(viewedMonday, index);
    const key = toKey(date);
    const button = document.createElement("button");
    button.type = "button";
    button.className = `day-btn${key === selectedDate ? " active" : ""}`;
    button.innerHTML = `<strong>${dayNames[index]}</strong><span>${date.getMonth() + 1}/${date.getDate()}</span>`;
    button.addEventListener("click", () => {
      selectedDate = key;
      render();
    });
    daysEl.appendChild(button);
  }
}

function renderMonth() {
  calendarWeekdays.innerHTML = "";
  dayNames.forEach((name) => {
    const cell = document.createElement("div");
    cell.textContent = name;
    calendarWeekdays.appendChild(cell);
  });

  calendarGrid.innerHTML = "";
  const firstDay = new Date(viewedMonth.getFullYear(), viewedMonth.getMonth(), 1);
  const gridStart = startOfWeek(firstDay);
  const todayKey = toKey(new Date());

  for (let index = 0; index < 42; index += 1) {
    const date = addDays(gridStart, index);
    const key = toKey(date);
    const count = getDayTaskCount(key);
    const button = document.createElement("button");
    button.type = "button";
    button.className = [
      "calendar-day",
      date.getMonth() === viewedMonth.getMonth() ? "" : "outside",
      key === calendarSelectedDate ? "active" : "",
      key === todayKey ? "today" : "",
      state.dayColors[key] ? `color-${state.dayColors[key]}` : ""
    ].filter(Boolean).join(" ");

    const dots = Array.from({ length: Math.min(count, 8) }, () => '<span class="task-dot"></span>').join("");
    button.innerHTML = `<span class="calendar-num">${date.getDate()}</span><span class="task-dots">${dots}</span>`;
    button.addEventListener("click", () => {
      calendarSelectedDate = key;
      renderMonth();
    });
    calendarGrid.appendChild(button);
  }

  renderDayDetail();
}

function renderDayDetail() {
  const date = parseDateKey(calendarSelectedDate);
  const data = state.days[calendarSelectedDate] || { todo: [], done: [] };
  const tasks = [
    ...data.todo.map((task) => ({ ...task, done: false })),
    ...data.done.map((task) => ({ ...task, done: true }))
  ];

  dayDetailTitle.textContent = `${formatDate(date)}`;
  dayDetailCount.textContent = `${tasks.length} 项`;
  renderDayColorPicker();
  dayDetailList.innerHTML = "";

  if (tasks.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "暂无计划";
    dayDetailList.appendChild(empty);
    return;
  }

  tasks.forEach((task) => {
    const row = document.createElement("div");
    row.className = `detail-task${task.done ? " done" : ""}`;
    row.innerHTML = `<span class="detail-mark"></span><span>${escapeHtml(task.text || "未命名计划")}</span>`;
    dayDetailList.appendChild(row);
  });
}

function renderDayColorPicker() {
  const selectedColor = state.dayColors[calendarSelectedDate] || "";
  dayColorPicker.innerHTML = "";
  calendarColors.forEach((color) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = `detail-color-chip ${color}${selectedColor === color ? " active" : ""}`;
    chip.title = color;
    chip.setAttribute("aria-label", `设置日期底色 ${color}`);
    chip.addEventListener("click", () => setCalendarDayColor(color));
    dayColorPicker.appendChild(chip);
  });
}

function setCalendarDayColor(color) {
  if (state.dayColors[calendarSelectedDate] === color) {
    delete state.dayColors[calendarSelectedDate];
  } else {
    state.dayColors[calendarSelectedDate] = color;
  }
  saveState();
  renderMonth();
}

function renderList(type) {
  const zone = zones[type];
  const list = zone.querySelector(".list");
  const data = currentData(type);
  zone.querySelector(".zone-count").textContent = `${data.length} 项`;
  list.innerHTML = "";

  if (data.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "暂无计划";
    list.appendChild(empty);
    return;
  }

  data.forEach((task, index) => {
    list.appendChild(createTaskElement(type, task, index));
  });
}

function createTaskElement(type, task, index) {
  const item = document.createElement("div");
  item.className = [
    "task",
    task.done ? "done" : "",
    task.color ? `color-${task.color}` : ""
  ].filter(Boolean).join(" ");
  item.dataset.type = type;
  item.dataset.index = String(index);

  const check = document.createElement("button");
  check.type = "button";
  check.className = "check-btn";
  check.title = task.done ? "取消完成" : "完成";
  check.setAttribute("aria-label", check.title);
  check.textContent = task.done ? "✓" : "";
  check.addEventListener("click", () => toggleDone(type, index));

  const text = document.createElement("div");
  text.className = "task-text";
  text.contentEditable = "true";
  text.spellcheck = false;
  text.textContent = task.text || "点击输入计划";
  text.addEventListener("focus", () => {
    if (text.textContent === "点击输入计划") text.textContent = "";
  });
  text.addEventListener("blur", () => {
    const value = text.textContent.trim();
    task.text = value || "未命名计划";
    saveState();
    renderList(type);
  });
  text.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      text.blur();
    }
  });

  const drag = document.createElement("button");
  drag.type = "button";
  drag.className = "icon-btn drag-btn";
  drag.title = "拖动排序";
  drag.setAttribute("aria-label", "拖动排序");
  drag.textContent = "☰";
  drag.addEventListener("pointerdown", (event) => startSort(event, type, index, item));
  drag.addEventListener("click", () => {
    if (suppressDragClick) {
      suppressDragClick = false;
      return;
    }
    toggleTaskColorPicker(type, index);
  });

  item.append(check, text, drag);
  if (isTaskColorPickerOpen(type, index)) {
    item.appendChild(createTaskColorPicker(type, task, index));
  }

  if (type === "weekTodo") {
    const send = document.createElement("button");
    send.type = "button";
    send.className = "icon-btn send-btn";
    send.title = "移到下一周";
    send.setAttribute("aria-label", "移到下一周");
    send.textContent = "↷";
    bindSendButton(send, type, index, () => moveToNextWeek(index), () => copyToNextWeek(index), "已复制到下一周");
    item.appendChild(send);
  }

  if (type === "dayTodo") {
    const send = document.createElement("button");
    send.type = "button";
    send.className = "icon-btn send-btn";
    send.title = "移到下一日";
    send.setAttribute("aria-label", "移到下一日");
    send.textContent = "↷";
    bindSendButton(send, type, index, () => moveToNextDay(index), () => copyToNextDay(index), "已复制到明天");
    item.appendChild(send);
  }

  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "icon-btn delete-btn";
  remove.title = "删除";
  remove.setAttribute("aria-label", "删除");
  remove.textContent = "×";
  bindPressButton(remove, type, index, () => deleteTask(type, index), () => copyToCurrentList(type, index), "已复制到当前", ".delete-btn");
  item.appendChild(remove);

  return item;
}

function isTaskColorPickerOpen(type, index) {
  return openTaskColorPicker?.type === type && openTaskColorPicker.index === index;
}

function toggleTaskColorPicker(type, index) {
  const previousType = openTaskColorPicker?.type;
  openTaskColorPicker = isTaskColorPickerOpen(type, index) ? null : { type, index };
  if (previousType && previousType !== type) renderList(previousType);
  renderList(type);
}

function closeTaskColorPicker() {
  if (!openTaskColorPicker) return;
  const type = openTaskColorPicker.type;
  openTaskColorPicker = null;
  renderList(type);
}

function createTaskColorPicker(type, task, index) {
  const picker = document.createElement("div");
  picker.className = "task-color-picker";
  picker.addEventListener("click", (event) => event.stopPropagation());
  calendarColors.forEach((color) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = `task-color-chip ${color}${task.color === color ? " active" : ""}`;
    chip.title = color;
    chip.setAttribute("aria-label", `设置计划条底色 ${color}`);
    chip.addEventListener("click", () => setTaskColor(type, index, color));
    picker.appendChild(chip);
  });
  return picker;
}

function setTaskColor(type, index, color) {
  const task = currentData(type)[index];
  if (!task) return;
  if (task.color === color) {
    delete task.color;
  } else {
    task.color = color;
  }
  saveState();
  renderList(type);
}

function bindSendButton(button, type, index, moveAction, copyAction, copyMessage) {
  bindPressButton(button, type, index, moveAction, copyAction, copyMessage, ".send-btn");
}

function bindPressButton(button, type, index, tapAction, holdAction, holdMessage, feedbackSelector) {
  let timer = null;
  let copied = false;

  const clearTimer = () => {
    if (!timer) return;
    window.clearTimeout(timer);
    timer = null;
  };

  button.addEventListener("pointerdown", (event) => {
    if (event.button !== undefined && event.button !== 0) return;
    copied = false;
    clearTimer();
    timer = window.setTimeout(() => {
      copied = true;
      timer = null;
      const taskId = currentData(type)[index]?.id;
      holdAction();
      window.setTimeout(() => showCopyFeedback(type, taskId, holdMessage, feedbackSelector), 0);
    }, 520);
  });

  button.addEventListener("pointerup", clearTimer);
  button.addEventListener("pointerleave", clearTimer);
  button.addEventListener("pointercancel", clearTimer);
  button.addEventListener("contextmenu", (event) => event.preventDefault());
  button.addEventListener("click", () => {
    if (copied) {
      copied = false;
      return;
    }
    tapAction();
  });
}

function showCopyFeedback(type, taskId, message, feedbackSelector) {
  if (!taskId) return;
  const list = currentData(type);
  const index = list.findIndex((task) => task.id === taskId);
  if (index < 0) return;
  const task = zones[type].querySelector(`.task[data-index="${index}"]`);
  if (!task) return;
  const button = task.querySelector(feedbackSelector);
  if (!button) return;
  const defaultText = button.textContent;

  button.classList.add("copied");
  button.textContent = "✓";

  task.querySelector(".copy-toast")?.remove();
  const toast = document.createElement("div");
  toast.className = "copy-toast";
  toast.textContent = message;
  task.appendChild(toast);
  const minLeft = toast.offsetWidth / 2 + 4;
  const maxLeft = task.clientWidth - toast.offsetWidth / 2 - 4;
  const buttonCenter = button.offsetLeft + button.offsetWidth / 2;
  const toastLeft = Math.max(minLeft, Math.min(buttonCenter, maxLeft));
  toast.style.left = `${toastLeft}px`;

  window.setTimeout(() => {
    button.classList.remove("copied");
    button.textContent = defaultText;
    toast.remove();
  }, 900);
}

function addTask(type, value) {
  const text = value.trim();
  if (!text) return;
  currentData(type).push({
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    text,
    done: false
  });
  render();
}

function toggleDone(type, index) {
  const from = currentData(type);
  const task = from.splice(index, 1)[0];
  if (!task) return;
  task.done = !task.done;

  const targetType = type === "weekTodo"
    ? "weekDone"
    : type === "weekDone"
      ? "weekTodo"
      : type === "dayTodo"
        ? "dayDone"
        : "dayTodo";
  currentData(targetType).push(task);
  render();
}

function moveToNextWeek(index) {
  const source = currentData("weekTodo");
  const task = source.splice(index, 1)[0];
  if (!task) return;
  const nextWeek = toKey(addDays(viewedMonday, 7));
  ensureWeek(nextWeek).todo.push({ ...task, done: false });
  render();
}

function copyToNextWeek(index) {
  const task = currentData("weekTodo")[index];
  if (!task) return;
  const nextWeek = toKey(addDays(viewedMonday, 7));
  ensureWeek(nextWeek).todo.push(cloneTaskForNextPeriod(task));
  render();
}

function moveToNextDay(index) {
  const source = currentData("dayTodo");
  const task = source.splice(index, 1)[0];
  if (!task) return;
  const nextDay = toKey(addDays(parseDateKey(selectedDate), 1));
  ensureDay(nextDay).todo.push({ ...task, done: false });
  render();
}

function copyToNextDay(index) {
  const task = currentData("dayTodo")[index];
  if (!task) return;
  const nextDay = toKey(addDays(parseDateKey(selectedDate), 1));
  ensureDay(nextDay).todo.push(cloneTaskForNextPeriod(task));
  render();
}

function copyToCurrentList(type, index) {
  const task = currentData(type)[index];
  if (!task) return;
  currentData(type).splice(index + 1, 0, cloneTaskForNextPeriod(task));
  render();
}

function cloneTaskForNextPeriod(task) {
  return {
    ...task,
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    done: false
  };
}

function deleteTask(type, index) {
  currentData(type).splice(index, 1);
  render();
}

function startSort(event, type, index, item) {
  if (event.button !== undefined && event.button !== 0) return;
  event.preventDefault();
  dragCancel();
  suppressDragClick = false;

  sorting = {
    type,
    index,
    item,
    startX: event.clientX,
    startY: event.clientY,
    lastX: event.clientX,
    lastY: event.clientY,
    active: false,
    ghost: null,
    ghostRect: null,
    bounds: null,
    timer: window.setTimeout(() => activateSort(), 160)
  };

  document.addEventListener("pointermove", onSortMove);
  document.addEventListener("pointerup", finishSort);
  document.addEventListener("pointercancel", dragCancel);
}

function activateSort() {
  if (!sorting || sorting.active) return;
  sorting.active = true;
  suppressDragClick = true;
  sorting.item.classList.add("dragging", "sorting");
  const rect = sorting.item.getBoundingClientRect();
  const bounds = zones[sorting.type].querySelector(".list").getBoundingClientRect();
  sorting.ghost = sorting.item.cloneNode(true);
  sorting.ghostRect = rect;
  sorting.bounds = bounds;
  sorting.ghost.classList.add("drag-ghost");
  sorting.ghost.style.width = `${rect.width}px`;
  document.body.appendChild(sorting.ghost);
  moveGhost();
}

function onSortMove(event) {
  if (!sorting) return;
  event.preventDefault();
  sorting.lastX = event.clientX;
  sorting.lastY = event.clientY;
  const moved = Math.abs(event.clientX - sorting.startX) + Math.abs(event.clientY - sorting.startY);
  if (moved > 6) activateSort();
  moveGhost();
}

function moveGhost() {
  if (!sorting?.ghost) return;
  const halfWidth = sorting.ghostRect.width / 2;
  const halfHeight = sorting.ghostRect.height / 2;
  const minX = sorting.bounds.left + halfWidth;
  const maxX = sorting.bounds.right - halfWidth;
  const minY = sorting.bounds.top + halfHeight;
  const maxY = sorting.bounds.bottom - halfHeight;
  const x = clamp(sorting.lastX, minX, maxX);
  const y = clamp(sorting.lastY, minY, maxY);
  sorting.ghost.style.left = `${x}px`;
  sorting.ghost.style.top = `${y}px`;
}

function finishSort(event) {
  if (!sorting) return;
  window.clearTimeout(sorting.timer);

  if (sorting.active) {
    const targetIndex = getDropIndex(event.clientX, event.clientY, sorting.type, sorting.index);
    reorderTask(sorting.type, sorting.index, targetIndex);
  }

  dragCancel();
}

function dragCancel() {
  if (!sorting) return;
  window.clearTimeout(sorting.timer);
  sorting.ghost?.remove();
  sorting.item.classList.remove("dragging", "sorting");
  document.removeEventListener("pointermove", onSortMove);
  document.removeEventListener("pointerup", finishSort);
  document.removeEventListener("pointercancel", dragCancel);
  sorting = null;
}

function getDropIndex(clientX, clientY, type, fromIndex) {
  const listEl = zones[type].querySelector(".list");
  const tasks = [...listEl.querySelectorAll(".task")];
  const element = document.elementFromPoint(clientX, clientY);
  const targetList = element?.closest(".list");
  const target = element?.closest(".task");

  if (targetList !== listEl) return fromIndex;
  if (!target || !listEl.contains(target)) return tasks.length - 1;

  const targetIndex = Number(target.dataset.index);
  const rect = target.getBoundingClientRect();
  const placeAfter = clientY > rect.top + rect.height / 2;
  let dropIndex = targetIndex + (placeAfter ? 1 : 0);
  if (dropIndex > fromIndex) dropIndex -= 1;
  return dropIndex;
}

function reorderTask(type, fromIndex, toIndex) {
  const list = currentData(type);
  const clampedIndex = Math.max(0, Math.min(toIndex, list.length - 1));
  if (fromIndex === clampedIndex) return;

  const task = list.splice(fromIndex, 1)[0];
  if (!task) return;
  list.splice(clampedIndex, 0, task);
  render();
}

function getDayTaskCount(key) {
  const data = state.days[key] || { todo: [], done: [] };
  return data.todo.length + data.done.length;
}

function toggleMonthView() {
  if (currentView === "month") {
    currentView = "board";
  } else {
    currentView = "month";
    calendarSelectedDate = selectedDate;
    const date = parseDateKey(selectedDate);
    viewedMonth = new Date(date.getFullYear(), date.getMonth(), 1);
  }
  render();
}

function shiftPeriod(direction) {
  if (currentView === "month") {
    shiftMonth(direction);
  } else {
    shiftWeek(direction);
  }
}

function shiftMonth(direction) {
  viewedMonth = new Date(viewedMonth.getFullYear(), viewedMonth.getMonth() + direction, 1);
  const selected = parseDateKey(calendarSelectedDate);
  if (selected.getFullYear() !== viewedMonth.getFullYear() || selected.getMonth() !== viewedMonth.getMonth()) {
    calendarSelectedDate = toKey(new Date(viewedMonth));
  }
  render();
}

function shiftWeek(direction) {
  viewedMonday = addDays(viewedMonday, direction * 7);
  const today = new Date();
  const weekEnd = addDays(viewedMonday, 6);
  if (today >= viewedMonday && today <= weekEnd) {
    selectedDate = toKey(today);
  } else {
    selectedDate = toKey(viewedMonday);
  }
  render();
}

function jumpToDay(key) {
  selectedDate = key;
  calendarSelectedDate = key;
  const date = parseDateKey(key);
  viewedMonday = startOfWeek(date);
  viewedMonth = new Date(date.getFullYear(), date.getMonth(), 1);
  currentView = "board";
  render();
}

function startOfWeek(date) {
  const value = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = value.getDay() || 7;
  value.setDate(value.getDate() - day + 1);
  return value;
}

function addDays(date, amount) {
  const value = new Date(date);
  value.setDate(value.getDate() + amount);
  return value;
}

function toKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateKey(key) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function clamp(value, min, max) {
  if (max < min) return min;
  return Math.max(min, Math.min(value, max));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(date) {
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}


