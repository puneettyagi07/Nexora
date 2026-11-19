/* ==========================================================================
   Nexora - MODULE 3: PROJECT MANAGEMENT & PROJECT DETAILS (js/projects.js)
   Features: Cards & Table Views, Create/Edit/Delete/Archive/Restore Projects,
   Search/Filter/Sort, Multi-Member Assignment, and Project Details View
   ========================================================================== */

import { StorageService } from './storage.js';
import {
  escapeHtml,
  formatDate,
  isOverdue,
  getPriorityBadgeClass,
  getStatusBadgeClass,
  showToast,
  openModal,
  closeModal,
  confirmDialog,
  refreshIcons
} from './utils.js';

const PRIORITY_WEIGHT = { Urgent: 4, High: 3, Medium: 2, Low: 1 };

export const ProjectsModule = {
  state: {
    viewMode: 'grid',       // 'grid' | 'table'
    statusFilter: 'All',    // 'All' | 'Planning' | 'Active' | 'On Hold' | 'Completed' | 'Archived'
    priorityFilter: 'All',  // 'All' | 'Low' | 'Medium' | 'High' | 'Urgent'
    sortBy: 'dueDate',      // 'dueDate' | 'progress' | 'name' | 'priority'
    searchQuery: ''
  },

  /**
   * Renders View 4: Projects Portfolio (#projects)
   */
  renderProjectsList(container) {
    if (!container) return;

    const allProjects = StorageService.getProjects();
    const activePortfolio = allProjects.filter(p => !p.archived);
    const archivedPortfolio = allProjects.filter(p => p.archived);
    const allTasks = StorageService.getTasks();
    const settings = StorageService.getSettings();
    const dateFmt = settings.dateFormat || 'MMM DD, YYYY';

    // 1. Filter by Status / Archive tab
    let filtered = this.state.statusFilter === 'Archived'
      ? [...archivedPortfolio]
      : activePortfolio.filter(p => this.state.statusFilter === 'All' || p.status === this.state.statusFilter);

    // 2. Filter by Priority
    if (this.state.priorityFilter !== 'All') {
      filtered = filtered.filter(p => p.priority === this.state.priorityFilter);
    }

    // 3. Filter by Search Query
    if (this.state.searchQuery.trim()) {
      const q = this.state.searchQuery.toLowerCase().trim();
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.description || '').toLowerCase().includes(q)
      );
    }

    // 4. Sort Projects
    filtered.sort((a, b) => {
      if (this.state.sortBy === 'name') return a.name.localeCompare(b.name);
      if (this.state.sortBy === 'progress') return (b.progress || 0) - (a.progress || 0);
      if (this.state.sortBy === 'priority') return (PRIORITY_WEIGHT[b.priority] || 0) - (PRIORITY_WEIGHT[a.priority] || 0);
      return new Date(a.dueDate || '2099-12-31') - new Date(b.dueDate || '2099-12-31');
    });

    // Status tab counts
    const counts = {
      All: activePortfolio.length,
      Planning: activePortfolio.filter(p => p.status === 'Planning').length,
      Active: activePortfolio.filter(p => p.status === 'Active').length,
      'On Hold': activePortfolio.filter(p => p.status === 'On Hold').length,
      Completed: activePortfolio.filter(p => p.status === 'Completed').length,
      Archived: archivedPortfolio.length
    };

    container.innerHTML = `
      <!-- Header -->
      <div class="view-header">
        <div>
          <h2>Project Portfolio</h2>
          <p class="text-sm text-secondary">Plan, track, and deliver initiatives across your workspace.</p>
        </div>
        <div class="view-header-actions">
          <button type="button" id="create-project-btn" class="btn btn-primary btn-sm">
            <i data-lucide="folder-plus"></i> New Project
          </button>
        </div>
      </div>

      <!-- Status Filter Pills -->
      <div class="status-tabs" role="tablist">
        ${['All', 'Planning', 'Active', 'On Hold', 'Completed', 'Archived'].map(tab => `
          <button
            type="button"
            class="status-tab ${this.state.statusFilter === tab ? 'active' : ''}"
            data-status-tab="${tab}"
          >
            <span>${tab}</span>
            <span class="status-tab-count">${counts[tab] ?? 0}</span>
          </button>
        `).join('')}
      </div>

      <!-- Search, Priority Filter, Sort & Grid/Table Toggle -->
      <section class="glass-card filter-toolbar">
        <div class="filter-group-left">
          <div class="filter-search-box">
            <i data-lucide="search"></i>
            <input
              type="search"
              id="project-search-input"
              class="filter-search-input"
              placeholder="Search projects by name or description..."
              value="${escapeHtml(this.state.searchQuery)}"
            />
          </div>

          <select id="project-priority-filter" class="filter-select" aria-label="Filter by Priority">
            <option value="All" ${this.state.priorityFilter === 'All' ? 'selected' : ''}>All Priorities</option>
            <option value="Urgent" ${this.state.priorityFilter === 'Urgent' ? 'selected' : ''}>Urgent Priority</option>
            <option value="High" ${this.state.priorityFilter === 'High' ? 'selected' : ''}>High Priority</option>
            <option value="Medium" ${this.state.priorityFilter === 'Medium' ? 'selected' : ''}>Medium Priority</option>
            <option value="Low" ${this.state.priorityFilter === 'Low' ? 'selected' : ''}>Low Priority</option>
          </select>

          <select id="project-sort-select" class="filter-select" aria-label="Sort Projects">
            <option value="dueDate" ${this.state.sortBy === 'dueDate' ? 'selected' : ''}>Sort: Due Date</option>
            <option value="progress" ${this.state.sortBy === 'progress' ? 'selected' : ''}>Sort: Progress %</option>
            <option value="priority" ${this.state.sortBy === 'priority' ? 'selected' : ''}>Sort: Priority</option>
            <option value="name" ${this.state.sortBy === 'name' ? 'selected' : ''}>Sort: Alphabetical</option>
          </select>
        </div>

        <div class="view-toggle-group" role="group" aria-label="View Mode">
          <button type="button" class="view-toggle-btn ${this.state.viewMode === 'grid' ? 'active' : ''}" data-view-mode="grid">
            <i data-lucide="layout-grid"></i> Cards
          </button>
          <button type="button" class="view-toggle-btn ${this.state.viewMode === 'table' ? 'active' : ''}" data-view-mode="table">
            <i data-lucide="table"></i> Table
          </button>
        </div>
      </section>

      <!-- Projects Content Area -->
      ${filtered.length === 0 ? `
        <div class="glass-card empty-state">
          <div class="empty-state-icon"><i data-lucide="folder-search"></i></div>
          <h3>No matching projects found</h3>
          <p class="text-sm text-secondary" style="max-width:420px;">
            ${this.state.statusFilter === 'Archived'
              ? 'You have no archived projects right now.'
              : 'Try adjusting your search or filters, or create a new project to get started.'}
          </p>
          ${this.state.statusFilter !== 'Archived' ? `
            <button type="button" id="empty-create-project-btn" class="btn btn-primary btn-sm">
              <i data-lucide="plus"></i> Create Project
            </button>
          ` : ''}
        </div>
      ` : this.state.viewMode === 'grid'
        ? this.renderGridCards(filtered, allTasks, dateFmt)
        : this.renderTableView(filtered, allTasks, dateFmt)
      }
    `;

    this.bindProjectsListEvents(container);
    refreshIcons();
  },

  /**
   * Renders the Project Cards Grid View
   */
  renderGridCards(projects, allTasks, dateFmt) {
    return `
      <div class="projects-grid">
        ${projects.map(proj => {
          const projTasks = allTasks.filter(t => t.projectId === proj.id);
          const completedTasks = projTasks.filter(t => t.status === 'Completed').length;
          const overdue = isOverdue(proj.dueDate, proj.status);
          const members = (proj.members || []).map(id => StorageService.getMemberById(id)).filter(Boolean);
          const priorityClass = proj.priority === 'Urgent' ? 'priority-urgent' : (proj.priority === 'High' ? 'priority-high' : '');
          const statusClass = proj.status === 'Completed' ? 'status-completed' : '';

          return `
            <article class="glass-card glass-card-interactive project-card ${priorityClass} ${statusClass}">
              <div>
                <div class="project-card-header">
                  <div>
                    <a href="#project-details?id=${proj.id}" class="project-card-title">${escapeHtml(proj.name)}</a>
                    <div class="flex items-center gap-2" style="margin-top:6px;">
                      <span class="badge ${getStatusBadgeClass(proj.status)}">${escapeHtml(proj.status)}</span>
                      <span class="badge ${getPriorityBadgeClass(proj.priority)}">${escapeHtml(proj.priority)}</span>
                      ${proj.archived ? `<span class="badge badge-danger">Archived</span>` : ''}
                    </div>
                  </div>

                  <div class="project-card-actions">
                    <button type="button" class="icon-btn" data-edit-project="${proj.id}" title="Edit Project">
                      <i data-lucide="edit-3"></i>
                    </button>
                    <button type="button" class="icon-btn" data-archive-project="${proj.id}" title="${proj.archived ? 'Restore Project' : 'Archive Project'}">
                      <i data-lucide="${proj.archived ? 'archive-restore' : 'archive'}"></i>
                    </button>
                    <button type="button" class="icon-btn text-danger" data-delete-project="${proj.id}" title="Delete Project">
                      <i data-lucide="trash-2"></i>
                    </button>
                  </div>
                </div>

                <p class="project-card-desc" style="margin-top:var(--space-3);">
                  ${escapeHtml(proj.description || 'No description provided.')}
                </p>
              </div>

              <div>
                <div class="flex justify-between items-center text-xs text-secondary" style="margin-bottom:6px;">
                  <span><i data-lucide="check-square" style="width:13px;height:13px;vertical-align:-2px;"></i> ${completedTasks}/${projTasks.length} Tasks</span>
                  <span class="font-bold text-primary">${proj.progress}%</span>
                </div>
                <div class="progress-track" style="margin-bottom:var(--space-3);">
                  <div class="progress-fill" style="width:${proj.progress}%;"></div>
                </div>

                <div class="project-card-meta">
                  <div class="avatar-stack">
                    ${members.map(m => `
                      <div class="avatar avatar-sm" style="background:${escapeHtml(m.avatarColor)};" title="${escapeHtml(m.name)} (${escapeHtml(m.role)})">
                        ${escapeHtml(m.avatar)}
                      </div>
                    `).join('')}
                  </div>

                  <div class="flex items-center gap-2">
                    <span class="${overdue ? 'text-danger font-semibold' : ''}">
                      ${overdue ? 'Overdue: ' : 'Due '} ${formatDate(proj.dueDate, dateFmt)}
                    </span>
                    <a href="#project-details?id=${proj.id}" class="btn btn-glass btn-xs">Details →</a>
                  </div>
                </div>
              </div>
            </article>
          `;
        }).join('')}
      </div>
    `;
  },

  /**
   * Renders the Responsive Project Table View
   */
  renderTableView(projects, allTasks, dateFmt) {
    return `
      <div class="glass-card table-container">
        <table class="glass-table">
          <thead>
            <tr>
              <th>Project Name</th>
              <th>Status</th>
              <th>Priority</th>
              <th>Progress</th>
              <th>Tasks</th>
              <th>Team</th>
              <th>Due Date</th>
              <th style="text-align:right;">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${projects.map(proj => {
              const projTasks = allTasks.filter(t => t.projectId === proj.id);
              const completedTasks = projTasks.filter(t => t.status === 'Completed').length;
              const overdue = isOverdue(proj.dueDate, proj.status);
              const members = (proj.members || []).map(id => StorageService.getMemberById(id)).filter(Boolean);

              return `
                <tr>
                  <td>
                    <a href="#project-details?id=${proj.id}" class="font-bold text-primary" style="display:block;">
                      ${escapeHtml(proj.name)}
                    </a>
                    <span class="text-xs text-secondary">${escapeHtml((proj.description || '').substring(0, 55))}${(proj.description || '').length > 55 ? '...' : ''}</span>
                  </td>
                  <td><span class="badge ${getStatusBadgeClass(proj.status)}">${escapeHtml(proj.status)}</span></td>
                  <td><span class="badge ${getPriorityBadgeClass(proj.priority)}">${escapeHtml(proj.priority)}</span></td>
                  <td style="min-width:140px;">
                    <div class="flex items-center gap-2">
                      <div class="progress-track" style="flex:1;">
                        <div class="progress-fill" style="width:${proj.progress}%;"></div>
                      </div>
                      <span class="text-xs font-bold">${proj.progress}%</span>
                    </div>
                  </td>
                  <td class="text-xs font-semibold">${completedTasks} / ${projTasks.length}</td>
                  <td>
                    <div class="avatar-stack">
                      ${members.map(m => `
                        <div class="avatar avatar-sm" style="background:${escapeHtml(m.avatarColor)};" title="${escapeHtml(m.name)}">
                          ${escapeHtml(m.avatar)}
                        </div>
                      `).join('')}
                    </div>
                  </td>
                  <td class="text-xs ${overdue ? 'text-danger font-semibold' : 'text-secondary'}">
                    ${formatDate(proj.dueDate, dateFmt)}
                  </td>
                  <td style="text-align:right;">
                    <div class="flex items-center gap-2" style="justify-content:flex-end;">
                      <a href="#project-details?id=${proj.id}" class="btn btn-glass btn-xs">View</a>
                      <button type="button" class="icon-btn" data-edit-project="${proj.id}" title="Edit"><i data-lucide="edit-3"></i></button>
                      <button type="button" class="icon-btn" data-archive-project="${proj.id}" title="${proj.archived ? 'Restore' : 'Archive'}">
                        <i data-lucide="${proj.archived ? 'archive-restore' : 'archive'}"></i>
                      </button>
                      <button type="button" class="icon-btn text-danger" data-delete-project="${proj.id}" title="Delete"><i data-lucide="trash-2"></i></button>
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
   * Binds events for View 4 (#projects)
   */
  bindProjectsListEvents(container) {
    container.querySelector('#create-project-btn')?.addEventListener('click', () => this.openProjectModal());
    container.querySelector('#empty-create-project-btn')?.addEventListener('click', () => this.openProjectModal());

    // Status tabs
    container.querySelectorAll('[data-status-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.state.statusFilter = btn.getAttribute('data-status-tab');
        this.renderProjectsList(container);
      });
    });

    // Search input
    const searchInput = container.querySelector('#project-search-input');
    searchInput?.addEventListener('input', (e) => {
      this.state.searchQuery = e.target.value;
      const cursorPos = e.target.selectionStart;
      this.renderProjectsList(container);
      const nextInput = container.querySelector('#project-search-input');
      if (nextInput) {
        nextInput.focus();
        nextInput.setSelectionRange(cursorPos, cursorPos);
      }
    });

    // Priority filter & Sort
    container.querySelector('#project-priority-filter')?.addEventListener('change', (e) => {
      this.state.priorityFilter = e.target.value;
      this.renderProjectsList(container);
    });

    container.querySelector('#project-sort-select')?.addEventListener('change', (e) => {
      this.state.sortBy = e.target.value;
      this.renderProjectsList(container);
    });

    // View mode toggle (Cards vs Table)
    container.querySelectorAll('[data-view-mode]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.state.viewMode = btn.getAttribute('data-view-mode');
        this.renderProjectsList(container);
      });
    });

    // Edit project buttons
    container.querySelectorAll('[data-edit-project]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const projectId = btn.getAttribute('data-edit-project');
        const proj = StorageService.getProjectById(projectId);
        if (proj) this.openProjectModal(proj);
      });
    });

    // Archive / Restore project buttons
    container.querySelectorAll('[data-archive-project]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const projectId = btn.getAttribute('data-archive-project');
        const updated = StorageService.toggleArchiveProject(projectId);
        if (updated) {
          showToast(
            updated.archived ? 'Project Archived' : 'Project Restored',
            `"${updated.name}" was ${updated.archived ? 'moved to the Archived tab' : 'restored to Active projects'}.`,
            'info'
          );
        }
      });
    });

    // Delete project buttons
    container.querySelectorAll('[data-delete-project]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const projectId = btn.getAttribute('data-delete-project');
        const proj = StorageService.getProjectById(projectId);
        if (!proj) return;

        confirmDialog({
          title: 'Delete Project?',
          message: `Are you sure you want to permanently delete "${proj.name}" and its associated tasks?`,
          confirmText: 'Delete Project',
          danger: true,
          onConfirm: () => {
            StorageService.deleteProject(proj.id);
            showToast('Project Deleted', `"${proj.name}" was permanently removed.`, 'warning');
          }
        });
      });
    });
  },

  /**
   * Renders View 5: Project Details (#project-details?id=...)
   */
  renderProjectDetails(container, projectId) {
    if (!container) return;

    const allProjects = StorageService.getProjects();
    const project = StorageService.getProjectById(projectId) || allProjects[0];

    if (!project) {
      container.innerHTML = `
        <div class="glass-card empty-state">
          <div class="empty-state-icon"><i data-lucide="folder-x"></i></div>
          <h3>Project Not Found</h3>
          <p class="text-sm text-secondary">The requested project does not exist or was deleted.</p>
          <a href="#projects" class="btn btn-primary btn-sm">← Back to Projects</a>
        </div>
      `;
      refreshIcons();
      return;
    }

    const settings = StorageService.getSettings();
    const dateFmt = settings.dateFormat || 'MMM DD, YYYY';
    const projectTasks = StorageService.getTasks().filter(t => t.projectId === project.id);
    const completedTasks = projectTasks.filter(t => t.status === 'Completed');
    const overdueTasks = projectTasks.filter(t => isOverdue(t.dueDate, t.status));
    const members = (project.members || []).map(id => StorageService.getMemberById(id)).filter(Boolean);

    container.innerHTML = `
      <!-- Top Breadcrumb & Navigation -->
      <div class="flex justify-between items-center" style="margin-bottom:var(--space-4);flex-wrap:wrap;gap:var(--space-3);">
        <a href="#projects" class="btn btn-glass btn-sm">
          <i data-lucide="arrow-left"></i> Back to Projects
        </a>

        <div class="flex items-center gap-2">
          <button type="button" id="detail-edit-project-btn" class="btn btn-glass btn-sm">
            <i data-lucide="edit-3"></i> Edit Project
          </button>
          <button type="button" id="detail-archive-project-btn" class="btn btn-glass btn-sm">
            <i data-lucide="${project.archived ? 'archive-restore' : 'archive'}"></i>
            ${project.archived ? 'Restore Project' : 'Archive'}
          </button>
          <button type="button" id="detail-delete-project-btn" class="btn btn-danger btn-sm">
            <i data-lucide="trash-2"></i> Delete
          </button>
        </div>
      </div>

      <!-- Project Header Banner -->
      <section class="glass-card project-detail-banner">
        <div class="project-detail-top">
          <div style="max-width:680px;">
            <div class="flex items-center gap-2" style="margin-bottom:var(--space-2);">
              <span class="badge ${getStatusBadgeClass(project.status)}">${escapeHtml(project.status)}</span>
              <span class="badge ${getPriorityBadgeClass(project.priority)}">${escapeHtml(project.priority)} Priority</span>
              ${project.archived ? `<span class="badge badge-danger">Archived</span>` : ''}
            </div>
            <h2 style="font-size:var(--text-2xl);margin-bottom:var(--space-2);">${escapeHtml(project.name)}</h2>
            <p class="text-sm text-secondary" style="line-height:1.6;">
              ${escapeHtml(project.description || 'No project description provided.')}
            </p>
          </div>

          <!-- Inline Quick Status Selector -->
          <div style="display:flex;flex-direction:column;gap:6px;min-width:190px;">
            <label class="text-xs font-semibold text-secondary">Project Status</label>
            <select id="detail-status-select" class="form-select">
              ${['Planning', 'Active', 'On Hold', 'Completed'].map(st => `
                <option value="${st}" ${project.status === st ? 'selected' : ''}>${st}</option>
              `).join('')}
            </select>
          </div>
        </div>

        <!-- Progress Bar -->
        <div>
          <div class="flex justify-between items-center text-xs" style="margin-bottom:6px;">
            <span class="font-semibold text-secondary">Overall Project Progress</span>
            <span class="font-bold text-teal">${project.progress}% Complete</span>
          </div>
          <div class="progress-track" style="height:10px;">
            <div class="progress-fill" style="width:${project.progress}%;"></div>
          </div>
        </div>

        <!-- Project Stats Row -->
        <div class="project-detail-stats">
          <div class="detail-stat-box">
            <span class="detail-stat-label">Timeline</span>
            <span class="text-xs font-semibold">${formatDate(project.startDate, dateFmt)} → ${formatDate(project.dueDate, dateFmt)}</span>
          </div>
          <div class="detail-stat-box">
            <span class="detail-stat-label">Total Tasks</span>
            <span class="detail-stat-value">${projectTasks.length}</span>
          </div>
          <div class="detail-stat-box">
            <span class="detail-stat-label">Completed Tasks</span>
            <span class="detail-stat-value text-success">${completedTasks.length}</span>
          </div>
          <div class="detail-stat-box">
            <span class="detail-stat-label">Overdue Tasks</span>
            <span class="detail-stat-value ${overdueTasks.length ? 'text-danger' : ''}">${overdueTasks.length}</span>
          </div>
        </div>
      </section>

      <!-- 2-Column Layout: Project Tasks + Assigned Team -->
      <div class="dash-content-grid">
        <!-- Project Tasks Section -->
        <section class="glass-card dash-panel">
          <div class="dash-panel-header">
            <div>
              <h3 class="dash-panel-title"><i data-lucide="check-square"></i> Project Tasks (${projectTasks.length})</h3>
              <p class="text-xs text-secondary">Check off tasks or add new deliverables to this project</p>
            </div>
            <button type="button" id="detail-add-task-btn" class="btn btn-accent btn-sm">
              <i data-lucide="plus"></i> Add Task
            </button>
          </div>

          ${projectTasks.length === 0 ? `
            <div class="empty-state" style="padding:var(--space-6);">
              <p class="text-sm text-secondary">No tasks assigned to this project yet.</p>
            </div>
          ` : `
            <div class="priority-task-list">
              ${projectTasks.map(task => {
                const assignee = StorageService.getMemberById(task.assignedTo);
                const isDone = task.status === 'Completed';
                const overdue = isOverdue(task.dueDate, task.status);

                return `
                  <div class="priority-task-item">
                    <div class="priority-task-left">
                      <input
                        type="checkbox"
                        class="task-check-input"
                        data-detail-toggle-task="${task.id}"
                        ${isDone ? 'checked' : ''}
                      />
                      <div class="priority-task-info">
                        <p class="priority-task-title ${isDone ? 'completed' : ''}">${escapeHtml(task.title)}</p>
                        <div class="priority-task-sub">
                          <span class="badge ${getStatusBadgeClass(task.status)}">${escapeHtml(task.status)}</span>
                          <span class="${overdue ? 'text-danger font-semibold' : ''}">Due ${formatDate(task.dueDate, dateFmt)}</span>
                        </div>
                      </div>
                    </div>

                    <div class="flex items-center gap-2">
                      <span class="badge ${getPriorityBadgeClass(task.priority)}">${escapeHtml(task.priority)}</span>
                      ${assignee ? `
                        <div class="avatar avatar-sm" style="background:${escapeHtml(assignee.avatarColor)};" title="${escapeHtml(assignee.name)}">
                          ${escapeHtml(assignee.avatar)}
                        </div>
                      ` : ''}
                      <button type="button" class="icon-btn text-danger" data-detail-delete-task="${task.id}" title="Delete Task">
                        <i data-lucide="trash-2"></i>
                      </button>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          `}
        </section>

        <!-- Assigned Team Members Panel -->
        <section class="glass-card dash-panel">
          <div class="dash-panel-header">
            <div>
              <h3 class="dash-panel-title"><i data-lucide="users"></i> Assigned Team (${members.length})</h3>
              <p class="text-xs text-secondary">Collaborators working on this project</p>
            </div>
            <button type="button" id="detail-manage-members-btn" class="text-btn">+ Edit Team</button>
          </div>

          <div style="display:flex;flex-direction:column;gap:var(--space-3);">
            ${members.map(m => {
              const memberProjectTasks = projectTasks.filter(t => t.assignedTo === m.id);
              return `
                <div class="priority-task-item">
                  <div class="flex items-center gap-3">
                    <div class="avatar avatar-md" style="background:${escapeHtml(m.avatarColor)};">${escapeHtml(m.avatar)}</div>
                    <div>
                      <p class="font-semibold text-sm">${escapeHtml(m.name)}</p>
                      <p class="text-xs text-secondary">${escapeHtml(m.role)} • ${escapeHtml(m.email)}</p>
                    </div>
                  </div>
                  <span class="badge badge-teal">${memberProjectTasks.length} tasks</span>
                </div>
              `;
            }).join('')}
          </div>
        </section>
      </div>
    `;

    // Bind Project Detail Events
    container.querySelector('#detail-status-select')?.addEventListener('change', (e) => {
      StorageService.updateProject(project.id, { status: e.target.value });
      showToast('Status Updated', `Project status changed to ${e.target.value}.`, 'success');
    });

    container.querySelector('#detail-edit-project-btn')?.addEventListener('click', () => {
      this.openProjectModal(project);
    });

    container.querySelector('#detail-manage-members-btn')?.addEventListener('click', () => {
      this.openProjectModal(project);
    });

    container.querySelector('#detail-archive-project-btn')?.addEventListener('click', () => {
      const updated = StorageService.toggleArchiveProject(project.id);
      if (updated) {
        showToast(updated.archived ? 'Project Archived' : 'Project Restored', `"${updated.name}" updated.`, 'info');
      }
    });

    container.querySelector('#detail-delete-project-btn')?.addEventListener('click', () => {
      confirmDialog({
        title: 'Delete Project?',
        message: `Permanently delete "${project.name}" and all ${projectTasks.length} tasks inside it?`,
        confirmText: 'Delete Project',
        danger: true,
        onConfirm: () => {
          StorageService.deleteProject(project.id);
          window.location.hash = '#projects';
          showToast('Project Deleted', `"${project.name}" was removed.`, 'warning');
        }
      });
    });

    container.querySelector('#detail-add-task-btn')?.addEventListener('click', () => {
      this.openProjectTaskModal(project);
    });

    container.querySelectorAll('[data-detail-toggle-task]').forEach(chk => {
      chk.addEventListener('change', () => {
        const taskId = chk.getAttribute('data-detail-toggle-task');
        StorageService.toggleTaskCompletion(taskId);
      });
    });

    container.querySelectorAll('[data-detail-delete-task]').forEach(btn => {
      btn.addEventListener('click', () => {
        const taskId = btn.getAttribute('data-detail-delete-task');
        StorageService.deleteTask(taskId);
        showToast('Task Removed', 'Task deleted from project.', 'info');
      });
    });

    refreshIcons();
  },

  /**
   * Opens Create / Edit Project Modal with Multi-Member Checkboxes
   */
  openProjectModal(existingProject = null) {
    const isEdit = Boolean(existingProject && existingProject.id);
    const team = StorageService.getTeam();
    const todayStr = new Date().toISOString().split('T')[0];
    const defaultDue = new Date(Date.now() + 86400000 * 14).toISOString().split('T')[0];
    const selectedMembers = new Set(existingProject?.members || ['mem_1']);

    openModal({
      title: isEdit ? `Edit Project: ${existingProject.name}` : 'Create New Project',
      bodyHtml: `
        <form id="project-crud-form" class="auth-form">
          <div class="form-group">
            <label class="form-label">Project Name <span class="required-star">*</span></label>
            <input
              type="text"
              name="name"
              class="form-input"
              required
              placeholder="e.g., Customer Portal Redesign"
              value="${escapeHtml(existingProject?.name || '')}"
            />
          </div>

          <div class="form-group">
            <label class="form-label">Description</label>
            <textarea
              name="description"
              rows="3"
              class="form-textarea"
              placeholder="Outline key goals, scope, and deliverables..."
            >${escapeHtml(existingProject?.description || '')}</textarea>
          </div>

          <div class="form-grid-2">
            <div class="form-group">
              <label class="form-label">Status</label>
              <select name="status" class="form-select">
                ${['Planning', 'Active', 'On Hold', 'Completed'].map(st => `
                  <option value="${st}" ${(existingProject?.status || 'Active') === st ? 'selected' : ''}>${st}</option>
                `).join('')}
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">Priority</label>
              <select name="priority" class="form-select">
                ${['Low', 'Medium', 'High', 'Urgent'].map(pr => `
                  <option value="${pr}" ${(existingProject?.priority || 'High') === pr ? 'selected' : ''}>${pr}</option>
                `).join('')}
              </select>
            </div>
          </div>

          <div class="form-grid-2">
            <div class="form-group">
              <label class="form-label">Start Date</label>
              <input
                type="date"
                name="startDate"
                class="form-input"
                required
                value="${escapeHtml(existingProject?.startDate || todayStr)}"
              />
            </div>

            <div class="form-group">
              <label class="form-label">Target Due Date <span class="required-star">*</span></label>
              <input
                type="date"
                name="dueDate"
                class="form-input"
                required
                value="${escapeHtml(existingProject?.dueDate || defaultDue)}"
              />
            </div>
          </div>

          <div class="form-group">
            <div class="flex justify-between items-center">
              <label class="form-label">Progress (<span id="proj-progress-val">${existingProject?.progress ?? 0}</span>%)</label>
              <span class="text-xs text-muted">Auto-updates as tasks complete</span>
            </div>
            <input
              type="range"
              name="progress"
              id="proj-progress-range"
              min="0"
              max="100"
              value="${existingProject?.progress ?? 0}"
              style="accent-color:var(--color-teal-primary);width:100%;cursor:pointer;"
            />
          </div>

          <div class="form-group">
            <label class="form-label">Assign Team Members</label>
            <div class="member-select-grid">
              ${team.map(m => `
                <label class="member-Option-chip">
                  <input
                    type="checkbox"
                    name="members"
                    value="${m.id}"
                    ${selectedMembers.has(m.id) ? 'checked' : ''}
                  />
                  <span class="avatar avatar-sm" style="background:${escapeHtml(m.avatarColor)};width:22px;height:22px;font-size:10px;">
                    ${escapeHtml(m.avatar)}
                  </span>
                  <span>${escapeHtml(m.name)}</span>
                </label>
              `).join('')}
            </div>
          </div>
        </form>
      `,
      footerHtml: `
        <button type="button" class="btn btn-glass btn-sm" id="proj-modal-cancel">Cancel</button>
        <button type="button" class="btn btn-primary btn-sm" id="proj-modal-save">
          ${isEdit ? 'Save Changes' : 'Create Project'}
        </button>
      `,
      onRender: (bodyEl, footerEl) => {
        const form = bodyEl.querySelector('#project-crud-form');
        const rangeInput = bodyEl.querySelector('#proj-progress-range');
        const rangeVal = bodyEl.querySelector('#proj-progress-val');

        rangeInput?.addEventListener('input', (e) => {
          if (rangeVal) rangeVal.textContent = e.target.value;
        });

        footerEl.querySelector('#proj-modal-cancel')?.addEventListener('click', closeModal);

        const handleSave = (e) => {
          if (e) e.preventDefault();
          if (!form.reportValidity()) return;

          const fd = new FormData(form);
          const chosenMembers = fd.getAll('members');

          const payload = {
            name: fd.get('name').trim(),
            description: fd.get('description').trim(),
            status: fd.get('status'),
            priority: fd.get('priority'),
            startDate: fd.get('startDate'),
            dueDate: fd.get('dueDate'),
            progress: Number(fd.get('progress')),
            members: chosenMembers.length > 0 ? chosenMembers : ['mem_1']
          };

          if (isEdit) {
            StorageService.updateProject(existingProject.id, payload);
            showToast('Project Updated', `"${payload.name}" changes saved.`, 'success');
          } else {
            StorageService.addProject(payload);
            showToast('Project Created', `"${payload.name}" added to your portfolio.`, 'success');
          }
          closeModal();
        };

        form?.addEventListener('submit', handleSave);
        footerEl.querySelector('#proj-modal-save')?.addEventListener('click', handleSave);
      }
    });
  },

  /**
   * Opens a modal to add a task directly inside the current Project Details page
   */
  openProjectTaskModal(project) {
    const team = StorageService.getTeam();

    openModal({
      title: `Add Task to "${project.name}"`,
      bodyHtml: `
        <form id="proj-detail-task-form" class="auth-form">
          <div class="form-group">
            <label class="form-label">Task Title <span class="required-star">*</span></label>
            <input type="text" name="title" class="form-input" required placeholder="e.g., Finalize responsive breakpoints" />
          </div>
          <div class="form-group">
            <label class="form-label">Description</label>
            <textarea name="description" rows="2" class="form-textarea" placeholder="Task notes and acceptance criteria..."></textarea>
          </div>
          <div class="form-grid-2">
            <div class="form-group">
              <label class="form-label">Assign To</label>
              <select name="assignedTo" class="form-select">
                ${team.map(m => `<option value="${m.id}">${escapeHtml(m.name)} (${escapeHtml(m.role)})</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Priority</label>
              <select name="priority" class="form-select">
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High" selected>High</option>
                <option value="Urgent">Urgent</option>
              </select>
            </div>
          </div>
          <div class="form-grid-2">
            <div class="form-group">
              <label class="form-label">Initial Status</label>
              <select name="status" class="form-select">
                <option value="To Do" selected>To Do</option>
                <option value="In Progress">In Progress</option>
                <option value="In Review">In Review</option>
                <option value="Completed">Completed</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Due Date <span class="required-star">*</span></label>
              <input type="date" name="dueDate" class="form-input" required value="${project.dueDate || new Date().toISOString().split('T')[0]}" />
            </div>
          </div>
        </form>
      `,
      footerHtml: `
        <button type="button" class="btn btn-glass btn-sm" id="cancel-proj-task">Cancel</button>
        <button type="button" class="btn btn-accent btn-sm" id="save-proj-task">Add Task</button>
      `,
      onRender: (bodyEl, footerEl) => {
        const form = bodyEl.querySelector('#proj-detail-task-form');
        footerEl.querySelector('#cancel-proj-task')?.addEventListener('click', closeModal);

        const handleTaskSave = (e) => {
          if (e) e.preventDefault();
          if (!form.reportValidity()) return;
          const fd = new FormData(form);
          StorageService.addTask({
            title: fd.get('title'),
            description: fd.get('description'),
            projectId: project.id,
            assignedTo: fd.get('assignedTo'),
            priority: fd.get('priority'),
            status: fd.get('status'),
            dueDate: fd.get('dueDate')
          });
          closeModal();
          showToast('Task Added', `Task added to "${project.name}".`, 'success');
        };

        form?.addEventListener('submit', handleTaskSave);
        footerEl.querySelector('#save-proj-task')?.addEventListener('click', handleTaskSave);
      }
    });
  }
};