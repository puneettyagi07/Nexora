/* ==========================================================================
   Nexora - MODULE 4: TASK MANAGEMENT SYSTEM (js/tasks.js)
   Features: Create/Edit/Delete Tasks, Subtasks Checklist, Labels,
   Assignees, Status Switcher, Search/Filter/Sort & Detailed Task Modal
   ========================================================================== */

import { StorageService } from './storage.js';
import {
  generateId,
  escapeHtml,
  formatDate,
  isOverdue,
  timeAgo,
  getPriorityBadgeClass,
  getStatusBadgeClass,
  showToast,
  openModal,
  closeModal,
  confirmDialog,
  refreshIcons
} from './utils.js';

const PRIORITY_WEIGHT = { Urgent: 4, High: 3, Medium: 2, Low: 1 };

export const TasksModule = {
  state: {
    viewMode: 'list',        // 'list' | 'table'
    statusFilter: 'All',     // 'All' | 'To Do' | 'In Progress' | 'In Review' | 'Completed' | 'Overdue'
    projectFilter: 'All',    // 'All' | projectId
    priorityFilter: 'All',   // 'All' | 'Low' | 'Medium' | 'High' | 'Urgent'
    assigneeFilter: 'All',   // 'All' | memberId
    sortBy: 'dueDate',       // 'dueDate' | 'priority' | 'title' | 'updatedAt'
    searchQuery: ''
  },

  /**
   * Calculates task progress % from its subtasks or overall status
   */
  getTaskProgress(task) {
    if (task.status === 'Completed') return 100;
    const subs = task.subtasks || [];
    if (subs.length > 0) {
      const done = subs.filter(s => s.completed).length;
      return Math.round((done / subs.length) * 100);
    }
    if (task.status === 'In Review') return 75;
    if (task.status === 'In Progress') return 45;
    return 0;
  },

  /**
   * Renders View 6: My Tasks (#tasks)
   */
  render(container) {
    if (!container) return;

    const allTasks = StorageService.getTasks();
    const projects = StorageService.getProjects().filter(p => !p.archived);
    const team = StorageService.getTeam();
    const settings = StorageService.getSettings();
    const dateFmt = settings.dateFormat || 'MMM DD, YYYY';

    // 1. Status Tab Counts
    const counts = {
      All: allTasks.length,
      'To Do': allTasks.filter(t => t.status === 'To Do').length,
      'In Progress': allTasks.filter(t => t.status === 'In Progress').length,
      'In Review': allTasks.filter(t => t.status === 'In Review').length,
      Completed: allTasks.filter(t => t.status === 'Completed').length,
      Overdue: allTasks.filter(t => isOverdue(t.dueDate, t.status)).length
    };

    // 2. Apply Filters
    let filtered = [...allTasks];

    if (this.state.statusFilter === 'Overdue') {
      filtered = filtered.filter(t => isOverdue(t.dueDate, t.status));
    } else if (this.state.statusFilter !== 'All') {
      filtered = filtered.filter(t => t.status === this.state.statusFilter);
    }

    if (this.state.projectFilter !== 'All') {
      filtered = filtered.filter(t => t.projectId === this.state.projectFilter);
    }

    if (this.state.priorityFilter !== 'All') {
      filtered = filtered.filter(t => t.priority === this.state.priorityFilter);
    }

    if (this.state.assigneeFilter !== 'All') {
      filtered = filtered.filter(t => t.assignedTo === this.state.assigneeFilter);
    }

    if (this.state.searchQuery.trim()) {
      const q = this.state.searchQuery.toLowerCase().trim();
      filtered = filtered.filter(t =>
        t.title.toLowerCase().includes(q) ||
        (t.description || '').toLowerCase().includes(q) ||
        (t.labels || []).some(lbl => lbl.toLowerCase().includes(q))
      );
    }

    // 3. Apply Sorting
    filtered.sort((a, b) => {
      if (this.state.sortBy === 'title') return a.title.localeCompare(b.title);
      if (this.state.sortBy === 'priority') return (PRIORITY_WEIGHT[b.priority] || 0) - (PRIORITY_WEIGHT[a.priority] || 0);
      if (this.state.sortBy === 'updatedAt') return new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt);
      return new Date(a.dueDate || '2099-12-31') - new Date(b.dueDate || '2099-12-31');
    });

    container.innerHTML = `
      <!-- Header -->
      <div class="view-header">
        <div>
          <h2>Task Management</h2>
          <p class="text-sm text-secondary">Organize deliverables, subtasks, priorities, and team assignments.</p>
        </div>
        <div class="view-header-actions">
          <a href="#kanban" class="btn btn-glass btn-sm">
            <i data-lucide="columns-3"></i> Kanban View
          </a>
          <button type="button" id="tasks-create-btn" class="btn btn-accent btn-sm">
            <i data-lucide="plus-circle"></i> New Task
          </button>
        </div>
      </div>

      <!-- Status Filter Tabs -->
      <div class="status-tabs" role="tablist">
        ${['All', 'To Do', 'In Progress', 'In Review', 'Completed', 'Overdue'].map(tab => `
          <button
            type="button"
            class="status-tab ${this.state.statusFilter === tab ? 'active' : ''}"
            data-task-status-tab="${tab}"
          >
            <span>${tab}</span>
            <span class="status-tab-count">${counts[tab] ?? 0}</span>
          </button>
        `).join('')}
      </div>

      <!-- Multi-Filter & Search Toolbar -->
      <section class="glass-card filter-toolbar">
        <div class="filter-group-left">
          <div class="filter-search-box">
            <i data-lucide="search"></i>
            <input
              type="search"
              id="task-search-input"
              class="filter-search-input"
              placeholder="Search title, description, or label..."
              value="${escapeHtml(this.state.searchQuery)}"
            />
          </div>

          <select id="task-project-filter" class="filter-select" aria-label="Filter by Project">
            <option value="All" ${this.state.projectFilter === 'All' ? 'selected' : ''}>All Projects</option>
            ${projects.map(p => `
              <option value="${p.id}" ${this.state.projectFilter === p.id ? 'selected' : ''}>${escapeHtml(p.name)}</option>
            `).join('')}
          </select>

          <select id="task-priority-filter" class="filter-select" aria-label="Filter by Priority">
            <option value="All" ${this.state.priorityFilter === 'All' ? 'selected' : ''}>All Priorities</option>
            <option value="Urgent" ${this.state.priorityFilter === 'Urgent' ? 'selected' : ''}>Urgent</option>
            <option value="High" ${this.state.priorityFilter === 'High' ? 'selected' : ''}>High</option>
            <option value="Medium" ${this.state.priorityFilter === 'Medium' ? 'selected' : ''}>Medium</option>
            <option value="Low" ${this.state.priorityFilter === 'Low' ? 'selected' : ''}>Low</option>
          </select>

          <select id="task-assignee-filter" class="filter-select" aria-label="Filter by Assignee">
            <option value="All" ${this.state.assigneeFilter === 'All' ? 'selected' : ''}>All Assignees</option>
            ${team.map(m => `
              <option value="${m.id}" ${this.state.assigneeFilter === m.id ? 'selected' : ''}>${escapeHtml(m.name)}</option>
            `).join('')}
          </select>

          <select id="task-sort-select" class="filter-select" aria-label="Sort Tasks">
            <option value="dueDate" ${this.state.sortBy === 'dueDate' ? 'selected' : ''}>Sort: Due Date</option>
            <option value="priority" ${this.state.sortBy === 'priority' ? 'selected' : ''}>Sort: Priority</option>
            <option value="updatedAt" ${this.state.sortBy === 'updatedAt' ? 'selected' : ''}>Sort: Recently Updated</option>
            <option value="title" ${this.state.sortBy === 'title' ? 'selected' : ''}>Sort: Alphabetical</option>
          </select>
        </div>

        <div class="view-toggle-group" role="group" aria-label="Task View Mode">
          <button type="button" class="view-toggle-btn ${this.state.viewMode === 'list' ? 'active' : ''}" data-task-view="list">
            <i data-lucide="list"></i> List
          </button>
          <button type="button" class="view-toggle-btn ${this.state.viewMode === 'table' ? 'active' : ''}" data-task-view="table">
            <i data-lucide="table"></i> Table
          </button>
        </div>
      </section>

      <!-- Tasks Results -->
      ${filtered.length === 0 ? `
        <div class="glass-card empty-state">
          <div class="empty-state-icon"><i data-lucide="clipboard-list"></i></div>
          <h3>No matching tasks found</h3>
          <p class="text-sm text-secondary" style="max-width:420px;">
            Try clearing your active search/filter criteria or create a new task for your team.
          </p>
          <button type="button" id="tasks-empty-create-btn" class="btn btn-accent btn-sm">
            <i data-lucide="plus"></i> Create New Task
          </button>
        </div>
      ` : this.state.viewMode === 'list'
        ? this.renderListView(filtered, dateFmt)
        : this.renderTableView(filtered, dateFmt)
      }
    `;

    this.bindEvents(container);
    refreshIcons();
  },

  /**
   * Renders Rich Task Cards List View
   */
  renderListView(tasks, dateFmt) {
    return `
      <div class="tasks-list-stack">
        ${tasks.map(task => {
      const project = StorageService.getProjectById(task.projectId);
      const assignee = StorageService.getMemberById(task.assignedTo);
      const isDone = task.status === 'Completed';
      const overdue = isOverdue(task.dueDate, task.status);
      const subtasks = task.subtasks || [];
      const completedSubs = subtasks.filter(s => s.completed).length;
      const progressPct = this.getTaskProgress(task);
      const priorityClass = task.priority === 'Urgent' ? 'priority-urgent' : (task.priority === 'High' ? 'priority-high' : '');

      return `
            <article class="glass-card glass-card-interactive task-row-card ${priorityClass} ${isDone ? 'status-completed' : ''}">
              <div class="task-row-main">
                <input
                  type="checkbox"
                  class="task-check-input"
                  data-task-toggle="${task.id}"
                  ${isDone ? 'checked' : ''}
                  title="Mark as ${isDone ? 'To Do' : 'Completed'}"
                />
                <div class="task-row-content">
                  <div class="task-row-title-line">
                    <span class="task-row-title ${isDone ? 'completed' : ''}" data-task-inspect="${task.id}">
                      ${escapeHtml(task.title)}
                    </span>
                    <span class="badge ${getPriorityBadgeClass(task.priority)}">${escapeHtml(task.priority)}</span>
                    ${(task.labels || []).map(lbl => `
                      <span class="task-label-chip"><i data-lucide="tag" style="width:10px;height:10px;"></i> ${escapeHtml(lbl)}</span>
                    `).join('')}
                  </div>

                  ${task.description ? `<p class="task-row-desc">${escapeHtml(task.description)}</p>` : ''}

                  <div class="task-row-meta">
                    ${project ? `
                      <a href="#project-details?id=${project.id}" class="text-teal font-semibold">
                        <i data-lucide="folder" style="width:12px;height:12px;vertical-align:-2px;"></i> ${escapeHtml(project.name)}
                      </a>
                    ` : '<span>General Workspace</span>'}
                    <span>•</span>
                    <span class="${overdue ? 'text-danger font-semibold' : ''}">
                      <i data-lucide="calendar" style="width:12px;height:12px;vertical-align:-2px;"></i>
                      ${overdue ? 'Overdue: ' : 'Due '} ${formatDate(task.dueDate, dateFmt)}
                    </span>
                    ${subtasks.length > 0 ? `
                      <span>•</span>
                      <span class="subtask-pill">
                        <i data-lucide="check-square" style="width:12px;height:12px;"></i>
                        ${completedSubs}/${subtasks.length} subtasks (${progressPct}%)
                      </span>
                    ` : ''}
                  </div>
                </div>
              </div>

              <div class="task-row-right">
                <!-- Inline Status Quick Switcher -->
                <select class="filter-select" data-task-status-select="${task.id}" aria-label="Change Task Status">
                  ${['To Do', 'In Progress', 'In Review', 'Completed'].map(st => `
                    <option value="${st}" ${task.status === st ? 'selected' : ''}>${st}</option>
                  `).join('')}
                </select>

                ${assignee ? `
                  <div class="avatar avatar-sm" style="background:${escapeHtml(assignee.avatarColor)};" title="Assigned to ${escapeHtml(assignee.name)}">
                    ${escapeHtml(assignee.avatar)}
                  </div>
                ` : ''}

                <div class="flex items-center gap-2">
                  <button type="button" class="btn btn-glass btn-xs" data-task-inspect="${task.id}">
                    Inspect
                  </button>
                  <button type="button" class="icon-btn" data-task-edit="${task.id}" title="Edit Task">
                    <i data-lucide="edit-3"></i>
                  </button>
                  <button type="button" class="icon-btn text-danger" data-task-delete="${task.id}" title="Delete Task">
                    <i data-lucide="trash-2"></i>
                  </button>
                </div>
              </div>
            </article>
          `;
    }).join('')}
      </div>
    `;
  },

  /**
   * Renders Compact Executive Table View
   */
  renderTableView(tasks, dateFmt) {
    return `
      <div class="glass-card table-container">
        <table class="glass-table">
          <thead>
            <tr>
              <th style="width:40px;">Done</th>
              <th>Task Title & Labels</th>
              <th>Project</th>
              <th>Status</th>
              <th>Priority</th>
              <th>Subtasks</th>
              <th>Assignee</th>
              <th>Due Date</th>
              <th style="text-align:right;">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${tasks.map(task => {
      const project = StorageService.getProjectById(task.projectId);
      const assignee = StorageService.getMemberById(task.assignedTo);
      const isDone = task.status === 'Completed';
      const overdue = isOverdue(task.dueDate, task.status);
      const subtasks = task.subtasks || [];
      const completedSubs = subtasks.filter(s => s.completed).length;

      return `
                <tr>
                  <td>
                    <input
                      type="checkbox"
                      class="task-check-input"
                      data-task-toggle="${task.id}"
                      ${isDone ? 'checked' : ''}
                    />
                  </td>
                  <td>
                    <span class="font-bold text-primary ${isDone ? 'subtask-done-text' : ''}" style="cursor:pointer;display:block;" data-task-inspect="${task.id}">
                      ${escapeHtml(task.title)}
                    </span>
                    <div class="flex items-center gap-2" style="margin-top:4px;flex-wrap:wrap;">
                      ${(task.labels || []).map(lbl => `<span class="task-label-chip">${escapeHtml(lbl)}</span>`).join('')}
                    </div>
                  </td>
                  <td>
                    ${project ? `<a href="#project-details?id=${project.id}" class="text-xs font-semibold text-teal">${escapeHtml(project.name)}</a>` : '—'}
                  </td>
                  <td>
                    <select class="filter-select" data-task-status-select="${task.id}">
                      ${['To Do', 'In Progress', 'In Review', 'Completed'].map(st => `
                        <option value="${st}" ${task.status === st ? 'selected' : ''}>${st}</option>
                      `).join('')}
                    </select>
                  </td>
                  <td><span class="badge ${getPriorityBadgeClass(task.priority)}">${escapeHtml(task.priority)}</span></td>
                  <td class="text-xs font-semibold">
                    ${subtasks.length ? `${completedSubs}/${subtasks.length}` : 'None'}
                  </td>
                  <td>
                    ${assignee ? `
                      <div class="flex items-center gap-2">
                        <div class="avatar avatar-sm" style="background:${escapeHtml(assignee.avatarColor)};">${escapeHtml(assignee.avatar)}</div>
                        <span class="text-xs">${escapeHtml(assignee.name)}</span>
                      </div>
                    ` : 'Unassigned'}
                  </td>
                  <td class="text-xs ${overdue ? 'text-danger font-semibold' : 'text-secondary'}">
                    ${formatDate(task.dueDate, dateFmt)}
                  </td>
                  <td style="text-align:right;">
                    <div class="flex items-center gap-2" style="justify-content:flex-end;">
                      <button type="button" class="btn btn-glass btn-xs" data-task-inspect="${task.id}">Inspect</button>
                      <button type="button" class="icon-btn" data-task-edit="${task.id}" title="Edit"><i data-lucide="edit-3"></i></button>
                      <button type="button" class="icon-btn text-danger" data-task-delete="${task.id}" title="Delete"><i data-lucide="trash-2"></i></button>
                    </div>
                  </td>
                </tr>
              `;
    }).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  /**
   * Binds interactive events for View 6 (#tasks)
   */
  bindEvents(container) {
    container.querySelector('#tasks-create-btn')?.addEventListener('click', () => this.openTaskModal());
    container.querySelector('#tasks-empty-create-btn')?.addEventListener('click', () => this.openTaskModal());

    // Status Tabs
    container.querySelectorAll('[data-task-status-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.state.statusFilter = btn.getAttribute('data-task-status-tab');
        this.render(container);
      });
    });

    // Search Input (preserves cursor)
    const searchInput = container.querySelector('#task-search-input');
    searchInput?.addEventListener('input', (e) => {
      this.state.searchQuery = e.target.value;
      const pos = e.target.selectionStart;
      this.render(container);
      const nextInput = container.querySelector('#task-search-input');
      if (nextInput) {
        nextInput.focus();
        nextInput.setSelectionRange(pos, pos);
      }
    });

    // Dropdown Filters & Sort
    container.querySelector('#task-project-filter')?.addEventListener('change', (e) => {
      this.state.projectFilter = e.target.value;
      this.render(container);
    });

    container.querySelector('#task-priority-filter')?.addEventListener('change', (e) => {
      this.state.priorityFilter = e.target.value;
      this.render(container);
    });

    container.querySelector('#task-assignee-filter')?.addEventListener('change', (e) => {
      this.state.assigneeFilter = e.target.value;
      this.render(container);
    });

    container.querySelector('#task-sort-select')?.addEventListener('change', (e) => {
      this.state.sortBy = e.target.value;
      this.render(container);
    });

    // View Mode Toggle (List vs Table)
    container.querySelectorAll('[data-task-view]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.state.viewMode = btn.getAttribute('data-task-view');
        this.render(container);
      });
    });

    // Checkbox 1-Click Completion
    container.querySelectorAll('[data-task-toggle]').forEach(chk => {
      chk.addEventListener('change', (e) => {
        e.stopPropagation();
        const taskId = chk.getAttribute('data-task-toggle');
        const updated = StorageService.toggleTaskCompletion(taskId);
        if (updated) {
          showToast(
            updated.status === 'Completed' ? 'Task Completed!' : 'Task Reopened',
            `"${updated.title}" marked as ${updated.status}.`,
            updated.status === 'Completed' ? 'success' : 'info'
          );
        }
      });
    });

    // Inline Status Select Change
    container.querySelectorAll('[data-task-status-select]').forEach(sel => {
      sel.addEventListener('change', (e) => {
        e.stopPropagation();
        const taskId = sel.getAttribute('data-task-status-select');
        const nextStatus = e.target.value;
        const updated = StorageService.updateTask(taskId, { status: nextStatus });
        if (updated) {
          showToast('Status Updated', `"${updated.title}" moved to ${nextStatus}.`, 'success');
        }
      });
    });

    // Open Detailed Task Inspection Modal
    container.querySelectorAll('[data-task-inspect]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const taskId = el.getAttribute('data-task-inspect');
        this.openTaskDetailModal(taskId);
      });
    });

    // Edit Task Button
    container.querySelectorAll('[data-task-edit]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const taskId = btn.getAttribute('data-task-edit');
        const task = StorageService.getTaskById(taskId);
        if (task) this.openTaskModal(task);
      });
    });

    // Delete Task Button
    container.querySelectorAll('[data-task-delete]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const taskId = btn.getAttribute('data-task-delete');
        const task = StorageService.getTaskById(taskId);
        if (!task) return;

        confirmDialog({
          title: 'Delete Task?',
          message: `Are you sure you want to permanently delete "${task.title}"?`,
          confirmText: 'Delete Task',
          danger: true,
          onConfirm: () => {
            StorageService.deleteTask(task.id);
            showToast('Task Deleted', `"${task.title}" was removed.`, 'warning');
          }
        });
      });
    });
  },

  /**
   * Opens Detailed Task Inspection Modal with Live Subtask Checklist & Progress Tracker
   */
  openTaskDetailModal(taskId) {
    const task = StorageService.getTaskById(taskId);
    if (!task) return;

    const project = StorageService.getProjectById(task.projectId);
    const assignee = StorageService.getMemberById(task.assignedTo);
    const settings = StorageService.getSettings();
    const dateFmt = settings.dateFormat || 'MMM DD, YYYY';
    const overdue = isOverdue(task.dueDate, task.status);
    const progressPct = this.getTaskProgress(task);

    openModal({
      title: 'Task Details & Subtasks',
      bodyHtml: `
        <div style="display:flex;flex-direction:column;gap:var(--space-4);">
          <!-- Badges & Status Switcher -->
          <div class="flex justify-between items-center" style="flex-wrap:wrap;gap:var(--space-2);">
            <div class="flex items-center gap-2">
              <span class="badge ${getStatusBadgeClass(task.status)}">${escapeHtml(task.status)}</span>
              <span class="badge ${getPriorityBadgeClass(task.priority)}">${escapeHtml(task.priority)} Priority</span>
              ${overdue ? `<span class="badge badge-danger">Overdue</span>` : ''}
            </div>

            <select id="inspect-status-select" class="filter-select">
              ${['To Do', 'In Progress', 'In Review', 'Completed'].map(st => `
                <option value="${st}" ${task.status === st ? 'selected' : ''}>Status: ${st}</option>
              `).join('')}
            </select>
          </div>

          <!-- Task Title & Description -->
          <div>
            <h3 style="font-size:var(--text-xl);margin-bottom:6px;">${escapeHtml(task.title)}</h3>
            <p class="text-sm text-secondary" style="line-height:1.6;">
              ${escapeHtml(task.description || 'No detailed description provided for this task.')}
            </p>
          </div>

          <!-- Labels -->
          <div class="flex items-center gap-2" style="flex-wrap:wrap;">
            ${(task.labels || []).map(lbl => `
              <span class="task-label-chip"><i data-lucide="tag" style="width:11px;height:11px;"></i> ${escapeHtml(lbl)}</span>
            `).join('')}
          </div>

          <!-- Metadata Grid -->
          <div class="form-grid-2" style="padding:var(--space-3);border-radius:var(--radius-sm);background:var(--glass-surface-subtle);border:var(--glass-border-subtle);">
            <div>
              <span class="text-xs text-muted font-semibold">PROJECT</span>
              <p class="text-sm font-semibold" style="margin-top:2px;">
                ${project ? `<a href="#project-details?id=${project.id}" class="text-teal" onclick="document.getElementById('modal-root').classList.add('hidden')">${escapeHtml(project.name)} →</a>` : 'Workspace Task'}
              </p>
            </div>
            <div>
              <span class="text-xs text-muted font-semibold">ASSIGNED TO</span>
              <div class="flex items-center gap-2" style="margin-top:2px;">
                ${assignee ? `
                  <div class="avatar avatar-sm" style="background:${escapeHtml(assignee.avatarColor)};width:22px;height:22px;font-size:10px;">${escapeHtml(assignee.avatar)}</div>
                  <span class="text-sm font-semibold">${escapeHtml(assignee.name)}</span>
                ` : '<span class="text-sm">Unassigned</span>'}
              </div>
            </div>
            <div>
              <span class="text-xs text-muted font-semibold">DUE DATE</span>
              <p class="text-sm font-semibold ${overdue ? 'text-danger' : ''}" style="margin-top:2px;">
                ${formatDate(task.dueDate, dateFmt)}
              </p>
            </div>
            <div>
              <span class="text-xs text-muted font-semibold">LAST UPDATED</span>
              <p class="text-sm text-secondary" style="margin-top:2px;">${timeAgo(task.updatedAt || task.createdAt)}</p>
            </div>
          </div>

          <!-- Task Progress & Interactive Subtasks -->
          <div>
            <div class="flex justify-between items-center text-xs" style="margin-bottom:6px;">
              <span class="font-semibold text-secondary">Task & Subtask Progress</span>
              <span class="font-bold text-teal" id="inspect-progress-label">${progressPct}%</span>
            </div>
            <div class="progress-track" style="margin-bottom:var(--space-3);">
              <div class="progress-fill" id="inspect-progress-bar" style="width:${progressPct}%;"></div>
            </div>

            <div class="subtasks-box">
              <div class="flex justify-between items-center">
                <span class="text-xs font-semibold text-secondary">SUBTASKS CHECKLIST (${(task.subtasks || []).length})</span>
              </div>

              <div id="inspect-subtasks-list" style="display:flex;flex-direction:column;gap:6px;">
                ${(task.subtasks || []).length === 0 ? `
                  <p class="text-xs text-muted" style="padding:6px 0;">No subtasks yet. Add one below to break down this deliverable.</p>
                ` : (task.subtasks || []).map(sub => `
                  <div class="subtask-item">
                    <label>
                      <input type="checkbox" data-inspect-sub-toggle="${sub.id}" ${sub.completed ? 'checked' : ''} />
                      <span class="${sub.completed ? 'subtask-done-text' : ''}">${escapeHtml(sub.title)}</span>
                    </label>
                    <button type="button" class="icon-btn text-danger" style="width:24px;height:24px;" data-inspect-sub-del="${sub.id}" title="Remove Subtask">
                      <i data-lucide="x"></i>
                    </button>
                  </div>
                `).join('')}
              </div>

              <div class="subtask-add-row">
                <input
                  type="text"
                  id="inspect-new-subtask-input"
                  class="form-input"
                  placeholder="Add a new subtask..."
                  style="padding:7px 11px;font-size:var(--text-xs);"
                />
                <button type="button" id="inspect-add-subtask-btn" class="btn btn-primary btn-xs" style="padding:8px 12px;">
                  + Add
                </button>
              </div>
            </div>
          </div>
        </div>
      `,
      footerHtml: `
        <button type="button" class="btn btn-danger btn-sm" id="inspect-delete-btn">
          <i data-lucide="trash-2"></i> Delete
        </button>
        <button type="button" class="btn btn-glass btn-sm" id="inspect-edit-btn">
          <i data-lucide="edit-3"></i> Edit Task
        </button>
        <button type="button" class="btn btn-primary btn-sm" id="inspect-close-btn">Done</button>
      `,
      onRender: (bodyEl, footerEl) => {
        // Status change inside detail modal
        bodyEl.querySelector('#inspect-status-select')?.addEventListener('change', (e) => {
          StorageService.updateTask(task.id, { status: e.target.value });
          showToast('Status Updated', `Task moved to ${e.target.value}.`, 'success');
          this.openTaskDetailModal(task.id);
        });

        // Toggle subtask completion
        bodyEl.querySelectorAll('[data-inspect-sub-toggle]').forEach(chk => {
          chk.addEventListener('change', () => {
            const subId = chk.getAttribute('data-inspect-sub-toggle');
            const freshTask = StorageService.getTaskById(task.id);
            if (!freshTask) return;
            const updatedSubs = (freshTask.subtasks || []).map(s =>
              s.id === subId ? { ...s, completed: chk.checked } : s
            );
            StorageService.updateTask(task.id, { subtasks: updatedSubs });
            this.openTaskDetailModal(task.id);
          });
        });

        // Delete subtask
        bodyEl.querySelectorAll('[data-inspect-sub-del]').forEach(btn => {
          btn.addEventListener('click', () => {
            const subId = btn.getAttribute('data-inspect-sub-del');
            const freshTask = StorageService.getTaskById(task.id);
            if (!freshTask) return;
            const updatedSubs = (freshTask.subtasks || []).filter(s => s.id !== subId);
            StorageService.updateTask(task.id, { subtasks: updatedSubs });
            this.openTaskDetailModal(task.id);
          });
        });

        // Add new subtask inline
        const subInput = bodyEl.querySelector('#inspect-new-subtask-input');
        const addSubtask = () => {
          const val = subInput?.value.trim();
          if (!val) return;
          const freshTask = StorageService.getTaskById(task.id);
          if (!freshTask) return;
          const updatedSubs = [
            ...(freshTask.subtasks || []),
            { id: generateId('sub'), title: val, completed: false }
          ];
          StorageService.updateTask(task.id, { subtasks: updatedSubs });
          this.openTaskDetailModal(task.id);
        };

        bodyEl.querySelector('#inspect-add-subtask-btn')?.addEventListener('click', addSubtask);
        subInput?.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            addSubtask();
          }
        });

        // Footer actions
        footerEl.querySelector('#inspect-close-btn')?.addEventListener('click', closeModal);
        footerEl.querySelector('#inspect-edit-btn')?.addEventListener('click', () => {
          const latest = StorageService.getTaskById(task.id);
          if (latest) this.openTaskModal(latest);
        });
        footerEl.querySelector('#inspect-delete-btn')?.addEventListener('click', () => {
          confirmDialog({
            title: 'Delete Task?',
            message: `Permanently delete "${task.title}"?`,
            confirmText: 'Delete Task',
            danger: true,
            onConfirm: () => {
              StorageService.deleteTask(task.id);
              showToast('Task Deleted', `"${task.title}" was removed.`, 'warning');
            }
          });
        });
      }
    });
  },

  /**
   * Opens Create / Edit Task Modal with Labels & Subtasks Builder
   */
  openTaskModal(existingTask = null, defaultProjectId = null) {
    const isEdit = Boolean(existingTask && existingTask.id);
    const projects = StorageService.getProjects().filter(p => !p.archived);
    const team = StorageService.getTeam();
    const defaultDue = new Date(Date.now() + 86400000 * 5).toISOString().split('T')[0];

    // Local working copy of subtasks inside the modal
    let workingSubtasks = isEdit
      ? (existingTask.subtasks || []).map(s => ({ ...s }))
      : [];

    const selectedProjectId = existingTask?.projectId || defaultProjectId || (projects[0]?.id ?? '');

    openModal({
      title: isEdit ? `Edit Task: ${existingTask.title}` : 'Create New Task',
      bodyHtml: `
        <form id="task-crud-form" class="auth-form">
          <div class="form-group">
            <label class="form-label">Task Title <span class="required-star">*</span></label>
            <input
              type="text"
              name="title"
              class="form-input"
              required
              placeholder="e.g., Implement OAuth2 session refresh"
              value="${escapeHtml(existingTask?.title || '')}"
            />
          </div>

          <div class="form-group">
            <label class="form-label">Description</label>
            <textarea
              name="description"
              rows="3"
              class="form-textarea"
              placeholder="Add acceptance criteria, links, or implementation notes..."
            >${escapeHtml(existingTask?.description || '')}</textarea>
          </div>

          <div class="form-grid-2">
            <div class="form-group">
              <label class="form-label">Project</label>
             <select name="projectId" class="form-select">
  <option value="">Personal / No Project</option>
  ${projects.map(p => `
    <option value="${p.id}" ${selectedProjectId === p.id ? 'selected' : ''}>${escapeHtml(p.name)}</option>
  `).join('')}
</select>
            </div>

            <div class="form-group">
              <label class="form-label">Assign To</label>
              <select name="assignedTo" class="form-select">
                ${team.map(m => `
                  <option value="${m.id}" ${(existingTask?.assignedTo || 'mem_1') === m.id ? 'selected' : ''}>
                    ${escapeHtml(m.name)} (${escapeHtml(m.role)})
                  </option>
                `).join('')}
              </select>
            </div>
          </div>

          <div class="form-grid-2">
            <div class="form-group">
              <label class="form-label">Status</label>
              <select name="status" class="form-select">
                ${['To Do', 'In Progress', 'In Review', 'Completed'].map(st => `
                  <option value="${st}" ${(existingTask?.status || 'To Do') === st ? 'selected' : ''}>${st}</option>
                `).join('')}
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">Priority</label>
              <select name="priority" class="form-select">
                ${['Low', 'Medium', 'High', 'Urgent'].map(pr => `
                  <option value="${pr}" ${(existingTask?.priority || 'Medium') === pr ? 'selected' : ''}>${pr}</option>
                `).join('')}
              </select>
            </div>
          </div>

          <div class="form-grid-2">
            <div class="form-group">
              <label class="form-label">Due Date <span class="required-star">*</span></label>
              <input
                type="date"
                name="dueDate"
                class="form-input"
                required
                value="${escapeHtml(existingTask?.dueDate || defaultDue)}"
              />
            </div>

            <div class="form-group">
              <label class="form-label">Labels (comma-separated)</label>
              <input
                type="text"
                name="labels"
                class="form-input"
                placeholder="Frontend, UI, Sprint"
                value="${escapeHtml((existingTask?.labels || ['General']).join(', '))}"
              />
            </div>
          </div>

          <!-- Subtasks Builder -->
          <div class="form-group">
            <label class="form-label">Subtasks Checklist</label>
            <div class="subtasks-box">
              <div id="modal-subtasks-container" style="display:flex;flex-direction:column;gap:6px;"></div>
              <div class="subtask-add-row">
                <input
                  type="text"
                  id="modal-new-subtask-text"
                  class="form-input"
                  placeholder="Type a subtask and click + Add..."
                  style="padding:7px 11px;font-size:var(--text-xs);"
                />
                <button type="button" id="modal-add-subtask-btn" class="btn btn-glass btn-xs" style="padding:8px 12px;">
                  + Add Subtask
                </button>
              </div>
            </div>
          </div>
        </form>
      `,
      footerHtml: `
        <button type="button" class="btn btn-glass btn-sm" id="task-modal-cancel">Cancel</button>
        <button type="button" class="btn btn-accent btn-sm" id="task-modal-save">
          ${isEdit ? 'Save Changes' : 'Create Task'}
        </button>
      `,
      onRender: (bodyEl, footerEl) => {
        const form = bodyEl.querySelector('#task-crud-form');
        const subListContainer = bodyEl.querySelector('#modal-subtasks-container');
        const subInput = bodyEl.querySelector('#modal-new-subtask-text');

        const renderWorkingSubtasks = () => {
          if (!subListContainer) return;
          if (workingSubtasks.length === 0) {
            subListContainer.innerHTML = `<span class="text-xs text-muted">No subtasks added yet.</span>`;
            return;
          }
          subListContainer.innerHTML = workingSubtasks.map((sub, idx) => `
            <div class="subtask-item">
              <label>
                <input type="checkbox" data-work-sub-idx="${idx}" ${sub.completed ? 'checked' : ''} />
                <span class="${sub.completed ? 'subtask-done-text' : ''}">${escapeHtml(sub.title)}</span>
              </label>
              <button type="button" class="icon-btn text-danger" style="width:24px;height:24px;" data-work-sub-remove="${idx}">
                &times;
              </button>
            </div>
          `).join('');

          subListContainer.querySelectorAll('[data-work-sub-idx]').forEach(chk => {
            chk.addEventListener('change', () => {
              const i = Number(chk.getAttribute('data-work-sub-idx'));
              if (workingSubtasks[i]) {
                workingSubtasks[i].completed = chk.checked;
                renderWorkingSubtasks();
              }
            });
          });

          subListContainer.querySelectorAll('[data-work-sub-remove]').forEach(btn => {
            btn.addEventListener('click', () => {
              const i = Number(btn.getAttribute('data-work-sub-remove'));
              workingSubtasks.splice(i, 1);
              renderWorkingSubtasks();
            });
          });
        };

        renderWorkingSubtasks();

        const handleAddSubtask = () => {
          const val = subInput?.value.trim();
          if (!val) return;
          workingSubtasks.push({
            id: generateId('sub'),
            title: val,
            completed: false
          });
          subInput.value = '';
          renderWorkingSubtasks();
        };

        bodyEl.querySelector('#modal-add-subtask-btn')?.addEventListener('click', handleAddSubtask);
        subInput?.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            handleAddSubtask();
          }
        });

        footerEl.querySelector('#task-modal-cancel')?.addEventListener('click', closeModal);

        const handleSaveTask = (e) => {
          if (e) e.preventDefault();
          if (!form.reportValidity()) return;

          const fd = new FormData(form);
          const rawLabels = String(fd.get('labels') || '')
            .split(',')
            .map(s => s.trim())
            .filter(Boolean);

          const payload = {
            title: fd.get('title').trim(),
            description: fd.get('description').trim(),
            projectId: fd.get('projectId'),
            assignedTo: fd.get('assignedTo'),
            status: fd.get('status'),
            priority: fd.get('priority'),
            dueDate: fd.get('dueDate'),
            labels: rawLabels.length > 0 ? rawLabels : ['General'],
            subtasks: workingSubtasks
          };

          if (isEdit) {
            StorageService.updateTask(existingTask.id, payload);
            showToast('Task Updated', `"${payload.title}" changes saved.`, 'success');
          } else {
            StorageService.addTask(payload);
            showToast('Task Created', `"${payload.title}" added to workspace.`, 'success');
          }
          closeModal();
        };

        form?.addEventListener('submit', handleSaveTask);
        footerEl.querySelector('#task-modal-save')?.addEventListener('click', handleSaveTask);
      }
    });
  }
};