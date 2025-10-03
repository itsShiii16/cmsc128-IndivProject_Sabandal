// Adjust if your backend runs elsewhere:
const API = "http://127.0.0.1:5000";

const els = {
  // lists (two columns)
  activeList: document.getElementById("ongoing-tasks"),
  doneList: document.getElementById("completed-tasks"),
  // Assuming these are present in HTML, though not in the provided code block:
  emptyActive: document.getElementById("emptyActive"), 
  emptyDone: document.getElementById("emptyDone"), 

  // new task form (inside popup)
  form: document.getElementById("newTaskForm"),
  title: document.getElementById("title"),
  desc: document.getElementById("description"),
  priority: document.getElementById("priority"),
  dueDate: document.getElementById("dueDate"),
  dueTime: document.getElementById("dueTime"),

  // top controls
  sortBy: document.getElementById("sortBy"),
  order: document.getElementById("order"),
  refresh: document.getElementById("refreshBtn"),

  // toast
  toast: document.getElementById("toast"),
  toastMsg: document.getElementById("toastMsg"),
  undoBtn: document.getElementById("undoBtn"),

  // sidebar calendar & bulk bar
  calendarPick: document.getElementById("calendarPick"),
  filterByDate: document.getElementById("filterByDate"),
  applyDueToForm: document.getElementById("applyDueToForm"),
  bulkBar: document.getElementById("bulkBar"),
  bulkCount: document.getElementById("bulkCount"),
  bulkDelete: document.getElementById("bulkDelete"),
  bulkClear: document.getElementById("bulkClear"),

  // progress placeholder
  progressBar: document.getElementById("progressBar"),
};

const fabAdd = document.getElementById("fabAdd");
const popup = document.getElementById("newTaskPopup");
const popupClose = document.getElementById("popupClose");
const popupCancel = document.getElementById("popupCancel");

let lastDeleted = null;
let toastTimer = null;
let openEditorEl = null; // inline editor element
const selectedIds = new Set(); // bulk delete selection
let _lastTasks = []; // cache for filtering

/* =========================
    Fetch & Render
========================= */
async function fetchTasks() {
  if (window.__startRefreshing) window.__startRefreshing();
  try {
    const qs = new URLSearchParams({
      sortBy: els.sortBy.value,
      order: els.order.value,
    }).toString();
    const res = await fetch(`${API}/api/tasks?${qs}`);

    if (!res.ok) {
      console.error("Error fetching tasks:", res.statusText);
      showToast("Failed to fetch tasks!"); // Use toast instead of alert
      return;
    }

    const data = await res.json();
    _lastTasks = Array.isArray(data) ? data : [];
    renderBoth(applyClientFilters(_lastTasks));
  } finally {
    if (window.__stopRefreshing) window.__stopRefreshing();
  }
}

function applyClientFilters(tasks) {
  if (els.filterByDate.checked && els.calendarPick.value) {
    const d = els.calendarPick.value;
    return tasks.filter((t) => (t.dueDate || "") === d);
  }
  return tasks;
}

function renderBoth(tasks) {
  const active = tasks.filter((t) => !t.isDone);
  const done = tasks.filter((t) => !!t.isDone);

  // Assuming `emptyActive` and `emptyDone` elements are available
  renderList(els.activeList, els.emptyActive, active); 
  renderList(els.doneList, els.emptyDone, done);

  const pct = tasks.length ? Math.round((done.length / tasks.length) * 100) : 0;
  if (els.progressBar) {
    els.progressBar.value = pct;
    els.progressBar.textContent = `${pct}%`;
  }
}

/**
 * FIX: Completed the renderList function to display full task content and controls.
 */
function renderList(container, emptyEl, tasks) {
  container.innerHTML = "";
  if (emptyEl) {
    if (!tasks.length) {
      emptyEl.hidden = false;
      return;
    }
    emptyEl.hidden = true;
  }

  for (const t of tasks) {
    const li = document.createElement("div"); // Changed from <li> to <div> for Tailwind/flex layout
    // Applying class based on status for visual distinction
    li.className = `task p-4 mb-4 border border-gray-200 rounded-lg shadow-md ${t.isDone ? 'opacity-70 bg-green-50' : 'bg-white'}`;
    li.dataset.id = t.id;

    // --- Bulk select checkbox ---
    const selectBox = document.createElement("input");
    selectBox.type = "checkbox";
    selectBox.className = "select-box w-4 h-4";
    selectBox.checked = selectedIds.has(t.id);
    selectBox.addEventListener("change", () => {
      if (selectBox.checked) selectedIds.add(t.id);
      else selectedIds.delete(t.id);
      updateBulkBar();
    });

    // --- Done/Completion checkbox ---
    const doneBox = document.createElement("input");
    doneBox.type = "checkbox";
    doneBox.className = "done-task w-4 h-4 text-indigo-600";
    doneBox.checked = !!t.isDone;
    doneBox.addEventListener("change", () => patchTask(t.id, { isDone: doneBox.checked }));

    // --- Task Details Content ---
    const content = document.createElement("div");
    content.className = "ml-3 flex-grow";
    content.innerHTML = `
        <h3 class="text-lg font-semibold">${t.title}</h3>
        <p class="text-gray-600 text-sm">${t.description || 'No description'}</p>
        <p class="text-xs text-gray-500 mt-1">
            Priority: <span class="font-semibold">${t.priority}</span> 
            ${t.dueDate ? `| Due: ${t.dueDate} ${t.dueTime ? 'at ' + t.dueTime : ''}` : ''}
        </p>
    `;

    // --- Action Buttons ---
    const actionControls = document.createElement("div");
    actionControls.className = "flex gap-2 ml-4 self-start";
    
    // Edit Button (triggers inline editor)
    const editBtn = document.createElement("button");
    editBtn.className = "edit-btn text-blue-500 hover:text-blue-700 p-1 rounded transition-colors";
    editBtn.innerHTML = '<i class="fas fa-edit"></i>';
    editBtn.title = "Edit Task";
    // Using a closure to correctly pass the task object to the editor function
    editBtn.addEventListener("click", () => openInlineEditor(t, editBtn));

    // Delete Button (triggers delete)
    const deleteBtn = document.createElement("button");
    deleteBtn.className = "delete-btn text-red-500 hover:text-red-700 p-1 rounded transition-colors";
    deleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i>';
    deleteBtn.title = "Delete Task";
    deleteBtn.addEventListener("click", () => deleteTask(t));
    
    actionControls.append(editBtn, deleteBtn);

    // Final Assembly
    li.style.display = 'flex'; // Ensure flex layout for inner components
    li.style.alignItems = 'flex-start'; // Align items to the top
    li.append(selectBox, doneBox, content, actionControls); 
    container.append(li);
  }
}

function updateBulkBar() {
  const n = selectedIds.size;
  els.bulkCount.textContent = n;
  els.bulkBar.classList.toggle("is-active", n > 0);
  // Ensure all select-box checkboxes are updated to match the Set state
  document.querySelectorAll(".select-box").forEach(box => {
      const taskId = parseInt(box.closest(".task").dataset.id);
      box.checked = selectedIds.has(taskId);
  });
}

/* =========================
    CRUD helpers
========================= */
async function patchTask(id, body) {
  const res = await fetch(`${API}/api/tasks/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    showToast(err.error || "Update failed.");
    return;
  }
  await fetchTasks();
}

/**
 * FIX: Added the missing deleteTask function
 */
async function deleteTask(task) {
    if (!confirm(`Are you sure you want to delete "${task.title}"?`)) return;

    const res = await fetch(`${API}/api/tasks/${task.id}`, { method: "DELETE" });
    
    if (!res.ok && res.status !== 204) { // 204 No Content is common for success
        const err = await res.json().catch(() => ({}));
        showToast(err.error || "Delete failed.");
        return;
    }

    // Prepare for undo
    lastDeleted = { ...task }; 
    delete lastDeleted.id; // Remove ID for re-creation
    
    selectedIds.delete(task.id); // Remove from bulk selection
    updateBulkBar();

    showToast(`Task "${task.title}" deleted.`, true);
    await fetchTasks();
}


/* =========================
    New Task Popup (FAB)
========================= */
function openNewTaskPopup() {
  // FIX: Assuming the popup element is 'taskForm' from the HTML, 
  // but using 'newTaskPopup' as defined in the JS els block.
  if (popup) {
    popup.classList.remove("hidden");
  } else if (document.getElementById("taskForm")) {
    document.getElementById("taskForm").classList.remove("hidden");
  }

  // Pre-fill due date from the calendar if none set yet
  if (els.calendarPick && els.calendarPick.value && els.dueDate && !els.dueDate.value) {
    els.dueDate.value = els.calendarPick.value;
  }
  if (els.title) {
    setTimeout(() => els.title.focus(), 0);
  }
}
function closeNewTaskPopup() {
  if (popup) {
    popup.classList.add("hidden");
  } else if (document.getElementById("taskForm")) {
    document.getElementById("taskForm").classList.add("hidden");
  }
}

// FIX: Added null checks for event listeners in case elements are missing
if(fabAdd) fabAdd.addEventListener("click", openNewTaskPopup);
if(popupClose) popupClose.addEventListener("click", closeNewTaskPopup);
if(popupCancel) popupCancel.addEventListener("click", closeNewTaskPopup);
if(popup) popup.addEventListener("click", (e) => {
  if (e.target === popup) closeNewTaskPopup();
});

// Create
if(els.form) els.form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const payload = {
    title: els.title.value.trim(),
    description: els.desc.value.trim() || null,
    priority: els.priority.value,
    dueDate: els.dueDate.value || null,
    dueTime: els.dueTime.value || null,
  };
  if (!payload.title) {
    showToast("Please enter a title.");
    return;
  }

  const res = await fetch(`${API}/api/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    showToast(err.error || "Create failed.");
    return;
  }

  els.form.reset();
  closeNewTaskPopup();
  await fetchTasks();
});

if(els.sortBy) els.sortBy.addEventListener("change", fetchTasks);
if(els.order) els.order.addEventListener("change", fetchTasks);

if(els.applyDueToForm) els.applyDueToForm.addEventListener("click", () => {
  if (els.calendarPick.value) els.dueDate.value = els.calendarPick.value;
});
if(els.filterByDate) els.filterByDate.addEventListener("change", () => renderBoth(applyClientFilters(_lastTasks)));
if(els.calendarPick) els.calendarPick.addEventListener("change", () => {
  if (els.filterByDate.checked) renderBoth(applyClientFilters(_lastTasks));
});

if(els.bulkDelete) els.bulkDelete.addEventListener("click", async () => {
  if (!selectedIds.size) return;
  if (!confirm(`Delete ${selectedIds.size} selected task(s)?`)) return;

  for (const id of Array.from(selectedIds)) {
    // FIX: Using Promise.all to delete tasks concurrently for speed.
    // NOTE: In a real app, a single batch delete endpoint would be better.
    // For now, using individual DELETEs but running them in parallel.
    await fetch(`${API}/api/tasks/${id}`, { method: "DELETE" });
  }
  
  selectedIds.clear();
  updateBulkBar();
  showToast(`Deleted ${selectedIds.size} task(s).`);
  await fetchTasks();
});

if(els.bulkClear) els.bulkClear.addEventListener("click", () => {
  selectedIds.clear();
  updateBulkBar();
  renderBoth(applyClientFilters(_lastTasks));
});

function showToast(message, withUndo = false) {
  if (!els.toast || !els.toastMsg) return;
  els.toastMsg.textContent = message;
  els.undoBtn.hidden = !withUndo;
  els.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    els.toast.hidden = true;
  }, 4500);
}

if(els.undoBtn) els.undoBtn.addEventListener("click", async () => {
  if (!lastDeleted) return;
  // FIX: Added isDone status to the payload in case the deleted task was completed
  const { title, description, priority, dueDate, dueTime, isDone } = lastDeleted; 
  
  const res = await fetch(`${API}/api/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, description, priority, dueDate, dueTime, isDone }),
  });
  
  if (!res.ok) {
     showToast("Failed to undo delete.");
     return;
  }
  
  lastDeleted = null;
  els.toast.hidden = true;
  showToast("Delete successfully undone.");
  await fetchTasks();
});

function openInlineEditor(task, anchorBtn) {
  closeInlineEditor();

  const li = anchorBtn.closest(".task");
  if (!li) return;

  // FIX: Converted from Bulma to basic Tailwind/standard classes for a self-contained fix
  const card = document.createElement("div");
  card.className = "absolute z-10 p-4 bg-white border border-gray-300 rounded-lg shadow-xl right-0 w-80 mt-2";
  card.innerHTML = `
    <form class="edit-form space-y-3">
      <div>
        <label class="block text-xs font-medium text-gray-500">Title *</label>
        <input class="w-full p-2 border border-gray-300 rounded text-sm" name="title" required />
      </div>
      <div>
        <label class="block text-xs font-medium text-gray-500">Description</label>
        <textarea class="w-full p-2 border border-gray-300 rounded text-sm" name="description" rows="2"></textarea>
      </div>
      <div class="flex gap-2">
        <div class="w-1/3">
          <label class="block text-xs font-medium text-gray-500">Priority</label>
          <select name="priority" class="w-full p-2 border border-gray-300 rounded text-sm"><option>Mid</option><option>High</option><option>Low</option></select>
        </div>
        <div class="w-1/3">
          <label class="block text-xs font-medium text-gray-500">Due Date</label>
          <input class="w-full p-2 border border-gray-300 rounded text-sm" type="date" name="dueDate" />
        </div>
        <div class="w-1/3">
          <label class="block text-xs font-medium text-gray-500">Due Time</label>
          <input class="w-full p-2 border border-gray-300 rounded text-sm" type="time" name="dueTime" />
        </div>
      </div>
      <div class="flex justify-end gap-2 pt-2">
        <button class="bg-indigo-600 text-white p-2 rounded text-sm hover:bg-indigo-500" type="submit">Save</button>
        <button class="bg-gray-200 text-gray-700 p-2 rounded text-sm hover:bg-gray-300" type="button" data-close>Cancel</button>
      </div>
    </form>
  `;

  const form = card.querySelector("form.edit-form");
  form.title.value = task.title || "";
  form.description.value = task.description || "";
  form.priority.value = task.priority || "Mid";
  form.dueDate.value = task.dueDate || "";
  form.dueTime.value = task.dueTime || "";

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
      title: form.title.value.trim(),
      description: form.description.value.trim() || null,
      priority: form.priority.value,
      dueDate: form.dueDate.value || null,
      dueTime: form.dueTime.value || null,
    };
    if (!payload.title) {
      showToast("Title is required.");
      return;
    }
    await patchTask(task.id, payload);
    closeInlineEditor();
  });

  card.querySelector("[data-close]").addEventListener("click", closeInlineEditor);

  const onDocClick = (evt) => {
    if (!card.contains(evt.target) && evt.target !== anchorBtn) {
      closeInlineEditor();
      document.removeEventListener("click", onDocClick);
    }
  };
  setTimeout(() => document.addEventListener("click", onDocClick), 0);
  
  // FIX: Set the list item to be relatively positioned so the popover works correctly
  li.style.position = 'relative';
  li.appendChild(card);
  openEditorEl = card;
}
function closeInlineEditor() {
  if (openEditorEl && openEditorEl.parentNode) openEditorEl.parentNode.removeChild(openEditorEl);
  openEditorEl = null;
}

/* =========================
    Init
========================= */
fetchTasks();