/* ==========================================================================
   Nexora - MODULE 5: INTERACTIVE KANBAN BOARD (js/kanban.js)
   Features: Native HTML5 Drag & Drop across 4 columns, Add/Edit/Delete/Inspect
   Tasks, Priority & Custom Labels, Due Dates, Assignee Avatars, Search & Filters
   ========================================================================== */

import { StorageService } from './storage.js';
import { TasksModule } from './tasks.js';
import {
  escapeHtml,
  formatDate,
  isOverdue,
  getPriorityBadgeClass,
  showToast,
  confirmDialog,
  refreshIcons
} from './utils.js';

const COLUMNS = [
  { status: 'To Do', title: 'To Do', dotClass: 'dot-todo' },
  { status: 'In Progress', title: 'In Progress', dotClass: 'dot-progress' },
  { status: 'In Review', title: 'In Review', dotClass: 'dot-review' },
  { status: 'Completed', title: 'Completed', dotClass: 'dot-completed' }
];

const PRIORITY_WEIGHT = { Urgent: 4, High: 3, Medium: 2, Low: 1 };

export const KanbanModule = {
  state: {
    searchQuery: '',
    priorityFilter: 'All',
    assigneeFilter: 'All',
    projectFilter: 'All',
    draggedTaskId: null
  },

  /**
   * Renders View 7: Kanban Board (#kanban)
   */
  render(container) {
    if (!container) return;

    const allTasks = StorageService.getTasks();
    const projects = StorageService.getProjects().filter(p => !p.archived);
    const team = StorageService.getTeam();
    const settings = StorageService.getSettings();
    const dateFmt = settings.dateFormat || 'MMM DD, YYYY';

    // Apply Search, Priority, Assignee, and Project Filters
    let filteredTasks = [...allTasks];

    if (this.state.searchQuery.trim()) {
      const q = this.state.searchQuery.toLowerCase().trim();
      filteredTasks = filteredTasks.filter(t =>
        t.title.toLowerCase().includes(q) ||
        (t.description || '').toLowerCase().includes(q) ||
        (t.labels || []).some(lbl => lbl.toLowerCase().includes(q))
      );
    }

    if (this.state.priorityFilter !== 'All') {
      filteredTasks = filteredTasks.filter(t => t.priority === this.state.priorityFilter);
    }

    if (this.state.assigneeFilter !== 'All') {
      filteredTasks = filteredTasks.filter(t => t.assignedTo === this.state.assigneeFilter);
    }

    if (this.state.projectFilter !== 'All') {
      filteredTasks = filteredTasks.filter(t => t.projectId === this.state.projectFilter);
    }

    // Sort cards inside each column by Priority (highest first), then Due Date
    filteredTasks.sort((a, b) => {
      const pDiff = (PRIORITY_WEIGHT[b.priority] || 0) - (PRIORITY_WEIGHT[a.priority] || 0);
      if (pDiff !== 0) return pDiff;
      return new Date(a.dueDate || '2099-12-31') - new Date(b.dueDate || '2099-12-31');
    });

    const hasActiveFilters =
      this.state.searchQuery.trim() !== '' ||
      this.state.priorityFilter !== 'All' ||
      this.state.assigneeFilter !== 'All' ||
      this.state.projectFilter !== 'All';

    container.innerHTML = `
      <!-- Header -->
      <div class="view-header">
        <div>
          <h2>Kanban Board</h2>
          <p class="text-sm text-secondary">Drag and drop task cards between columns to update workflow status in real time.</p>
        </div>
        <div class="view-header-actions">
          <a href="#tasks" class="btn btn-glass btn-sm">
            <i data-lucide="list"></i> List & Table View
          </a>
          <button type="button" id="kanban-new-task-btn" class="btn btn-accent btn-sm">
            <i data-lucide="plus-circle"></i> New Task
          </button>
        </div>
      </div>

      <!-- Search & Filter Bar -->
      <section class="glass-card kanban-toolbar">
        <div class="kanban-filters-left">
          <div class="filter-search-box">
            <i data-lucide="search"></i>
            <input
              type="search"
              id="kanban-search-input"
              class="filter-search-input"
              placeholder="Search tasks or labels..."
              value="${escapeHtml(this.state.searchQuery)}"
            />
          </div>

          <select id="kanban-priority-filter" class="filter-select" aria-label="Filter by Priority">
            <option value="All" ${this.state.priorityFilter === 'All' ? 'selected' : ''}>All Priorities</option>
            <option value="Urgent" ${this.state.priorityFilter === 'Urgent' ? 'selected' : ''}>Urgent Priority</option>
            <option value="High" ${this.state.priorityFilter === 'High' ? 'selected' : ''}>High Priority</option>
            <option value="Medium" ${this.state.priorityFilter === 'Medium' ? 'selected' : ''}>Medium Priority</option>
            <option value="Low" ${this.state.priorityFilter === 'Low' ? 'selected' : ''}>Low Priority</option>
          </select>

          <select id="kanban-assignee-filter" class="filter-select" aria-label="Filter by Assignee">
            <option value="All" ${this.state.assigneeFilter === 'All' ? 'selected' : ''}>All Assignees</option>
            ${team.map(m => `
              <option value="${m.id}" ${this.state.assigneeFilter === m.id ? 'selected' : ''}>${escapeHtml(m.name)}</option>
            `).join('')}
          </select>

          <select id="kanban-project-filter" class="filter-select" aria-label="Filter by Project">
            <option value="All" ${this.state.projectFilter === 'All' ? 'selected' : ''}>All Projects</option>
            ${projects.map(p => `
              <option value="${p.id}" ${this.state.projectFilter === p.id ? 'selected' : ''}>${escapeHtml(p.name)}</option>
            `).join('')}
          </select>

          <!-- Quick Team Avatar Pills -->
          <div class="kanban-avatar-filters" title="Quick filter by team member">
            ${team.map(m => `
              <button
                type="button"
                class="kanban-avatar-btn ${this.state.assigneeFilter === m.id ? 'active' : ''}"
                data-avatar-filter="${m.id}"
                title="Filter by ${escapeHtml(m.name)}"
              >
                <span class="avatar avatar-sm" style="background:${escapeHtml(m.avatarColor)};">
                  ${escapeHtml(m.avatar)}
                </span>
              </button>
            `).join('')}
          </div>
        </div>

        ${hasActiveFilters ? `
          <button type="button" id="kanban-clear-filters-btn" class="btn btn-glass btn-xs">
            <i data-lucide="rotate-ccw"></i> Clear Filters
          </button>
        ` : ''}
      </section>

      <!-- 4-Column Kanban Grid -->
      <section class="kanban-board-grid" aria-label="Kanban Columns">
        ${COLUMNS.map(col => {
          const colTasks = filteredTasks.filter(t => t.status === col.status);
          return this.renderColumn(col, colTasks, dateFmt);
        }).join('')}
      </section>
    `;

    this.bindToolbarAndCardEvents(container);
    this.bindDragAndDropEvents(container);
    refreshIcons();
  },

  /**
   * Renders an individual Kanban Column and its cards
   */
  renderColumn(col, colTasks, dateFmt) {
    return `
      <div class="kanban-column" data-column-status="${escapeHtml(col.status)}">
        <!-- Column Header -->
        <div class="kanban-col-header">
          <div class="kanban-col-title-wrap">
            <span class="kanban-col-dot ${col.dotClass}"></span>
            <h3 class="kanban-col-title">${escapeHtml(col.title)}</h3>
            <span class="kanban-col-count">${colTasks.length}</span>
          </div>
          <button
            type="button"
            class="kanban-card-btn"
            data-col-add="${escapeHtml(col.status)}"
            title="Add task to ${escapeHtml(col.title)}"
          >
            <i data-lucide="plus"></i>
          </button>
        </div>

        <!-- Column Cards List -->
        <div class="kanban-col-body">
          ${colTasks.length === 0 ? `
            <div class="kanban-empty-slot">
              <i data-lucide="inbox" style="width:20px;height:20px;opacity:0.6;"></i>
              <span>Drop tasks here or click + Add Task</span>
            </div>
          ` : colTasks.map(task => this.renderCard(task, dateFmt)).join('')}
        </div>

        <!-- Column Footer -->
        <div class="kanban-col-footer">
          <button type="button" class="kanban-col-add-btn" data-col-add="${escapeHtml(col.status)}">
            <i data-lucide="plus" style="width:14px;height:14px;"></i>
            <span>Add Task to ${escapeHtml(col.title)}</span>
          </button>
        </div>
      </div>
    `;
  },

  /**
   * Renders a single draggable Kanban Task Card
   */
  renderCard(task, dateFmt) {
    const project = StorageService.getProjectById(task.projectId);
    const assignee = StorageService.getMemberById(task.assignedTo);
    const overdue = isOverdue(task.dueDate, task.status);
    const isDone = task.status === 'Completed';
    const subtasks = task.subtasks || [];
    const doneSubs = subtasks.filter(s => s.completed).length;
    const subPct = subtasks.length > 0 ? Math.round((doneSubs / subtasks.length) * 100) : 0;

    const priorityClass =
      task.priority === 'Urgent' ? 'priority-urgent' :
      task.priority === 'High' ? 'priority-high' :
      task.priority === 'Low' ? 'priority-low' : '';

    return `
      <article
        class="kanban-card ${priorityClass} ${isDone ? 'card-completed' : ''}"
        draggable="true"
        data-kanban-task-id="${task.id}"
      >
        <!-- Top Row: Priority Badge + Edit & Delete Buttons -->
        <div class="kanban-card-top">
          <span class="badge ${getPriorityBadgeClass(task.priority)}">${escapeHtml(task.priority)}</span>

          <div class="kanban-card-actions">
            <button type="button" class="kanban-card-btn" data-kanban-inspect="${task.id}" title="View Details & Subtasks">
              <i data-lucide="eye"></i>
            </button>
            <button type="button" class="kanban-card-btn" data-kanban-edit="${task.id}" title="Edit Task">
              <i data-lucide="edit-3"></i>
            </button>
            <button type="button" class="kanban-card-btn danger" data-kanban-delete="${task.id}" title="Delete Task">
              <i data-lucide="trash-2"></i>
            </button>
          </div>
        </div>

        <!-- Task Title & Short Description -->
        <div>
          <h4 class="kanban-card-title ${isDone ? 'done' : ''}" data-kanban-inspect="${task.id}">
            ${escapeHtml(task.title)}
          </h4>
          ${task.description ? `
            <p class="kanban-card-desc" style="margin-top:4px;">${escapeHtml(task.description)}</p>
          ` : ''}
        </div>

        <!-- Project & Custom Labels -->
        <div class="kanban-card-tags">
          ${project ? `
            <span class="kanban-project-tag">
              <i data-lucide="folder" style="width:11px;height:11px;"></i>
              ${escapeHtml(project.name)}
            </span>
          ` : ''}
          ${(task.labels || []).map(lbl => `
            <span class="task-label-chip">${escapeHtml(lbl)}</span>
          `).join('')}
        </div>

        <!-- Subtask Checklist Progress Bar (if subtasks exist) -->
        ${subtasks.length > 0 ? `
          <div class="kanban-subtask-bar">
            <div class="flex justify-between items-center text-xs text-secondary">
              <span><i data-lucide="check-square" style="width:11px;height:11px;vertical-align:-1px;"></i> Subtasks</span>
              <span class="font-semibold">${doneSubs}/${subtasks.length} (${subPct}%)</span>
            </div>
            <div class="progress-track" style="height:5px;">
              <div class="progress-fill" style="width:${subPct}%;"></div>
            </div>
          </div>
        ` : ''}

        <!-- Card Footer: Due Date + Assignee Avatar -->
        <div class="kanban-card-footer">
          <span class="kanban-due-date ${overdue ? 'overdue' : ''}">
            <i data-lucide="${overdue ? 'alert-triangle' : 'calendar'}" style="width:12px;height:12px;"></i>
            ${overdue ? 'Overdue: ' : ''}${formatDate(task.dueDate, dateFmt)}
          </span>

          ${assignee ? `
            <div class="kanban-assignee-chip" title="Assigned to ${escapeHtml(assignee.name)} (${escapeHtml(assignee.role)})">
              <span class="text-xs text-secondary">${escapeHtml(assignee.name.split(' ')[0])}</span>
              <div class="avatar avatar-sm" style="background:${escapeHtml(assignee.avatarColor)};width:24px;height:24px;font-size:10px;">
                ${escapeHtml(assignee.avatar)}
              </div>
            </div>
          ` : '<span class="text-xs text-muted">Unassigned</span>'}
        </div>
      </article>
    `;
  },

  /**
   * Binds Toolbar Filters, Add Task, Edit Task, Delete Task & Inspect Events
   */
  bindToolbarAndCardEvents(container) {
    // Top "+ New Task" button
    container.querySelector('#kanban-new-task-btn')?.addEventListener('click', () => {
      TasksModule.openTaskModal();
    });

    // Column "+ Add Task" buttons (opens Task Modal pre-set to that column's status)
    container.querySelectorAll('[data-col-add]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const defaultStatus = btn.getAttribute('data-col-add');
        TasksModule.openTaskModal({ status: defaultStatus });
      });
    });

    // Search input (preserves cursor focus)
    const searchInput = container.querySelector('#kanban-search-input');
    searchInput?.addEventListener('input', (e) => {
      this.state.searchQuery = e.target.value;
      const pos = e.target.selectionStart;
      this.render(container);
      const nextInput = container.querySelector('#kanban-search-input');
      if (nextInput) {
        nextInput.focus();
        nextInput.setSelectionRange(pos, pos);
      }
    });

    // Priority, Assignee, and Project Filters
    container.querySelector('#kanban-priority-filter')?.addEventListener('change', (e) => {
      this.state.priorityFilter = e.target.value;
      this.render(container);
    });

    container.querySelector('#kanban-assignee-filter')?.addEventListener('change', (e) => {
      this.state.assigneeFilter = e.target.value;
      this.render(container);
    });

    container.querySelector('#kanban-project-filter')?.addEventListener('change', (e) => {
      this.state.projectFilter = e.target.value;
      this.render(container);
    });

    // Quick Avatar Filter Pills
    container.querySelectorAll('[data-avatar-filter]').forEach(btn => {
      btn.addEventListener('click', () => {
        const memId = btn.getAttribute('data-avatar-filter');
        this.state.assigneeFilter = this.state.assigneeFilter === memId ? 'All' : memId;
        this.render(container);
      });
    });

    // Clear All Filters
    container.querySelector('#kanban-clear-filters-btn')?.addEventListener('click', () => {
      this.state.searchQuery = '';
      this.state.priorityFilter = 'All';
      this.state.assigneeFilter = 'All';
      this.state.projectFilter = 'All';
      this.render(container);
    });

    // Inspect Task Details
    container.querySelectorAll('[data-kanban-inspect]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const taskId = el.getAttribute('data-kanban-inspect');
        TasksModule.openTaskDetailModal(taskId);
      });
    });

    // Edit Task
    container.querySelectorAll('[data-kanban-edit]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const taskId = btn.getAttribute('data-kanban-edit');
        const task = StorageService.getTaskById(taskId);
        if (task) TasksModule.openTaskModal(task);
      });
    });

    // Delete Task
    container.querySelectorAll('[data-kanban-delete]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const taskId = btn.getAttribute('data-kanban-delete');
        const task = StorageService.getTaskById(taskId);
        if (!task) return;

        confirmDialog({
          title: 'Delete Task from Board?',
          message: `Are you sure you want to permanently delete "${task.title}"?`,
          confirmText: 'Delete Task',
          danger: true,
          onConfirm: () => {
            StorageService.deleteTask(task.id);
            showToast('Task Deleted', `"${task.title}" was removed from the board.`, 'warning');
          }
        });
      });
    });
  },

  /**
   * Native HTML5 Drag and Drop Implementation
   */
  bindDragAndDropEvents(container) {
    const cards = container.querySelectorAll('.kanban-card[draggable="true"]');
    const columns = container.querySelectorAll('.kanban-column');

    // 1. Card Drag Start / End
    cards.forEach(card => {
      card.addEventListener('dragstart', (e) => {
        const taskId = card.getAttribute('data-kanban-task-id');
        this.state.draggedTaskId = taskId;

        if (e.dataTransfer) {
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', taskId);
        }

        requestAnimationFrame(() => {
          card.classList.add('dragging');
        });
      });

      card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
        this.state.draggedTaskId = null;
        columns.forEach(col => col.classList.remove('drag-over'));
      });
    });

    // 2. Column DragOver / DragLeave / Drop (Bound to full column for reliable drop target)
    columns.forEach(col => {
      col.addEventListener('dragover', (e) => {
        e.preventDefault();
        if (e.dataTransfer) {
          e.dataTransfer.dropEffect = 'move';
        }
        if (!col.classList.contains('drag-over')) {
          col.classList.add('drag-over');
        }
      });

      col.addEventListener('dragleave', (e) => {
        if (!col.contains(e.relatedTarget)) {
          col.classList.remove('drag-over');
        }
      });

      col.addEventListener('drop', (e) => {
        e.preventDefault();
        col.classList.remove('drag-over');

        const targetStatus = col.getAttribute('data-column-status');
        const taskId = (e.dataTransfer && e.dataTransfer.getData('text/plain')) || this.state.draggedTaskId;
        this.state.draggedTaskId = null;

        if (!taskId || !targetStatus) return;

        const task = StorageService.getTaskById(taskId);
        if (!task || task.status === targetStatus) return;

        // Update Task Status in LocalStorage (automatically syncs project progress & emits event)
        StorageService.updateTask(taskId, { status: targetStatus });

        if (targetStatus === 'Completed') {
          StorageService.addNotification('Task Completed on Kanban', `"${task.title}" was moved to Completed.`, 'completion');
          showToast('Task Completed!', `"${task.title}" moved to Completed.`, 'success');
        } else {
          showToast('Status Updated', `"${task.title}" moved to ${targetStatus}.`, 'info');
        }
      });
    });
  }
};