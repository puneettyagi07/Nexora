/* ==========================================================================
   Nexora - MODULE 7: TEAM MANAGEMENT (js/team.js)
   Features: Member Directory Cards & Table View, Workload Utilization Bars,
   Assigned Projects/Tasks Breakdown, Add/Edit/Remove Member & Search/Filter
   ========================================================================== */

import { StorageService } from './storage.js';
import { TasksModule } from './tasks.js';
import {
  escapeHtml,
  showToast,
  openModal,
  closeModal,
  confirmDialog,
  refreshIcons
} from './utils.js';

const AVATAR_PALETTE = [
  { hex: '#17645F', name: 'Deep Teal' },
  { hex: '#FF6845', name: 'Coral Orange' },
  { hex: '#16A36A', name: 'Emerald Green' },
  { hex: '#F59E0B', name: 'Amber Gold' },
  { hex: '#3B82F6', name: 'Ocean Blue' },
  { hex: '#8B5CF6', name: 'Royal Violet' }
];

export const TeamModule = {
  state: {
    viewMode: 'grid',         // 'grid' | 'table'
    departmentFilter: 'All',  // 'All' | 'Product' | 'Engineering' | 'Design' | 'QA' | 'Operations'
    searchQuery: ''
  },

  /**
   * Computes workload percentage and label for a member based on active tasks
   */
  getMemberWorkload(memberId, allTasks, allProjects) {
    const memberTasks = allTasks.filter(t => t.assignedTo === memberId);
    const activeTasks = memberTasks.filter(t => t.status !== 'Completed');
    const completedTasks = memberTasks.filter(t => t.status === 'Completed');
    const assignedProjects = allProjects.filter(p => !p.archived && (p.members || []).includes(memberId));

    // 4 active tasks = 100% capacity benchmark
    const utilizationPct = Math.min(100, Math.round((activeTasks.length / 4) * 100));
    let statusLabel = 'Optimal Load';
    let badgeClass = 'badge-teal';

    if (activeTasks.length === 0) {
      statusLabel = 'Available';
      badgeClass = 'badge-success';
    } else if (activeTasks.length >= 4) {
      statusLabel = 'High Load';
      badgeClass = 'badge-coral';
    }

    return {
      totalTasks: memberTasks.length,
      activeTasks: activeTasks.length,
      completedTasks: completedTasks.length,
      assignedProjects,
      utilizationPct,
      statusLabel,
      badgeClass
    };
  },

  /**
   * Renders View 9: Team Management (#team)
   */
  render(container) {
    if (!container) return;

    const team = StorageService.getTeam();
    const allTasks = StorageService.getTasks();
    const allProjects = StorageService.getProjects();

    // Filter members
    let filtered = [...team];

    if (this.state.departmentFilter !== 'All') {
      filtered = filtered.filter(m => (m.department || 'Engineering') === this.state.departmentFilter);
    }

    if (this.state.searchQuery.trim()) {
      const q = this.state.searchQuery.toLowerCase().trim();
      filtered = filtered.filter(m =>
        m.name.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        m.role.toLowerCase().includes(q)
      );
    }

    const totalActiveTasks = allTasks.filter(t => t.status !== 'Completed').length;
    const avgTasksPerMember = team.length ? (totalActiveTasks / team.length).toFixed(1) : 0;

    container.innerHTML = `
      <!-- Header -->
      <div class="view-header">
        <div>
          <h2>Team Directory & Workload</h2>
          <p class="text-sm text-secondary">Manage workspace collaborators, roles, assigned deliverables, and capacity.</p>
        </div>
        <div class="view-header-actions">
          <button type="button" id="team-add-member-btn" class="btn btn-primary btn-sm">
            <i data-lucide="user-plus"></i> Add Team Member
          </button>
        </div>
      </div>

      <!-- Team KPI Summary Row -->
      <section class="kpi-grid">
        <article class="glass-card kpi-card">
          <div class="kpi-card-top">
            <span class="kpi-label">Total Members</span>
            <div class="kpi-icon teal"><i data-lucide="users"></i></div>
          </div>
          <div class="kpi-value">${team.length}</div>
          <div class="kpi-meta"><span>Active workspace roster</span></div>
        </article>

        <article class="glass-card kpi-card">
          <div class="kpi-card-top">
            <span class="kpi-label">Active Projects</span>
            <div class="kpi-icon coral"><i data-lucide="folder-kanban"></i></div>
          </div>
          <div class="kpi-value">${allProjects.filter(p => !p.archived).length}</div>
          <div class="kpi-meta"><span>Cross-functional squads</span></div>
        </article>

        <article class="glass-card kpi-card">
          <div class="kpi-card-top">
            <span class="kpi-label">Avg Active Workload</span>
            <div class="kpi-icon success"><i data-lucide="bar-chart-2"></i></div>
          </div>
          <div class="kpi-value">${avgTasksPerMember}</div>
          <div class="kpi-meta"><span>Pending tasks per member</span></div>
        </article>
      </section>

      <!-- Search & Department Filter Toolbar -->
      <section class="glass-card filter-toolbar">
        <div class="filter-group-left">
          <div class="filter-search-box">
            <i data-lucide="search"></i>
            <input
              type="search"
              id="team-search-input"
              class="filter-search-input"
              placeholder="Search member by name, role, or email..."
              value="${escapeHtml(this.state.searchQuery)}"
            />
          </div>

          <select id="team-dept-filter" class="filter-select" aria-label="Filter by Department">
            <option value="All" ${this.state.departmentFilter === 'All' ? 'selected' : ''}>All Departments</option>
            <option value="Product" ${this.state.departmentFilter === 'Product' ? 'selected' : ''}>Product</option>
            <option value="Engineering" ${this.state.departmentFilter === 'Engineering' ? 'selected' : ''}>Engineering</option>
            <option value="Design" ${this.state.departmentFilter === 'Design' ? 'selected' : ''}>Design</option>
            <option value="QA" ${this.state.departmentFilter === 'QA' ? 'selected' : ''}>QA & Release</option>
            <option value="Operations" ${this.state.departmentFilter === 'Operations' ? 'selected' : ''}>Operations</option>
          </select>
        </div>

        <div class="view-toggle-group">
          <button type="button" class="view-toggle-btn ${this.state.viewMode === 'grid' ? 'active' : ''}" data-team-view="grid">
            <i data-lucide="layout-grid"></i> Cards
          </button>
          <button type="button" class="view-toggle-btn ${this.state.viewMode === 'table' ? 'active' : ''}" data-team-view="table">
            <i data-lucide="table"></i> Table
          </button>
        </div>
      </section>

      <!-- Team Directory Content -->
      ${filtered.length === 0 ? `
        <div class="glass-card empty-state">
          <div class="empty-state-icon"><i data-lucide="user-x"></i></div>
          <h3>No matching team members found</h3>
          <p class="text-sm text-secondary">Try clearing your search filter or add a new collaborator to the workspace.</p>
          <button type="button" id="team-empty-add-btn" class="btn btn-primary btn-sm">+ Add Member</button>
        </div>
      ` : this.state.viewMode === 'grid'
        ? this.renderCardsGrid(filtered, allTasks, allProjects)
        : this.renderTableView(filtered, allTasks, allProjects)
      }
    `;

    this.bindEvents(container);
    refreshIcons();
  },

  /**
   * Renders Member Profile Cards Grid
   */
  renderCardsGrid(members, allTasks, allProjects) {
    return `
      <div class="team-grid">
        ${members.map(m => {
          const load = this.getMemberWorkload(m.id, allTasks, allProjects);

          return `
            <article class="glass-card glass-card-interactive team-card" style="border-top-color:${escapeHtml(m.avatarColor || '#17645F')};">
              <div>
                <div class="team-card-top">
                  <div class="team-profile-head">
                    <div class="avatar avatar-lg" style="background:${escapeHtml(m.avatarColor || '#17645F')};">
                      ${escapeHtml(m.avatar)}
                    </div>
                    <div>
                      <h3 class="text-md font-bold">${escapeHtml(m.name)}</h3>
                      <p class="text-xs font-semibold text-teal">${escapeHtml(m.role)}</p>
                      <span class="badge badge-teal" style="margin-top:4px;">${escapeHtml(m.department || 'Engineering')}</span>
                    </div>
                  </div>

                  <div class="flex items-center gap-2">
                    <button type="button" class="icon-btn" data-edit-member="${m.id}" title="Edit Member">
                      <i data-lucide="edit-3"></i>
                    </button>
                    <button type="button" class="icon-btn text-danger" data-delete-member="${m.id}" title="Remove Member">
                      <i data-lucide="trash-2"></i>
                    </button>
                  </div>
                </div>

                <!-- Email Copy Row -->
                <div class="flex justify-between items-center text-xs text-secondary" style="margin-top:var(--space-3);padding:8px 10px;border-radius:var(--radius-xs);background:var(--glass-surface-subtle);">
                  <span><i data-lucide="mail" style="width:12px;height:12px;vertical-align:-2px;"></i> ${escapeHtml(m.email)}</span>
                  <button type="button" class="text-btn" data-copy-email="${escapeHtml(m.email)}">Copy</button>
                </div>
              </div>

              <!-- Assigned Projects & Tasks Metrics -->
              <div class="team-stats-row">
                <div>
                  <span class="team-stat-num">${load.assignedProjects.length}</span>
                  <span class="team-stat-lbl">Projects</span>
                </div>
                <div>
                  <span class="team-stat-num text-coral">${load.activeTasks}</span>
                  <span class="team-stat-lbl">Active Tasks</span>
                </div>
                <div>
                  <span class="team-stat-num text-success">${load.completedTasks}</span>
                  <span class="team-stat-lbl">Completed</span>
                </div>
              </div>

              <!-- Workload Utilization Bar -->
              <div class="workload-bar-wrap">
                <div class="flex justify-between items-center text-xs">
                  <span class="font-semibold text-secondary">Workload Overview</span>
                  <span class="badge ${load.badgeClass}">${load.statusLabel} (${load.utilizationPct}%)</span>
                </div>
                <div class="progress-track">
                  <div class="progress-fill" style="width:${load.utilizationPct}%;"></div>
                </div>
              </div>

              <!-- Footer Quick Actions -->
              <div class="flex justify-between items-center" style="padding-top:var(--space-2);border-top:var(--glass-border-subtle);">
                <button type="button" class="btn btn-glass btn-xs" data-assign-task-to="${m.id}">
                  <i data-lucide="plus"></i> Assign Task
                </button>
                <a href="#tasks" class="text-btn" data-view-member-tasks="${m.id}">View Tasks →</a>
              </div>
            </article>
          `;
        }).join('')}
      </div>
    `;
  },

  /**
   * Renders Responsive Team Directory Table
   */
  renderTableView(members, allTasks, allProjects) {
    return `
      <div class="glass-card table-container">
        <table class="glass-table">
          <thead>
            <tr>
              <th>Member</th>
              <th>Role & Department</th>
              <th>Email</th>
              <th>Assigned Projects</th>
              <th>Active Tasks</th>
              <th>Workload</th>
              <th style="text-align:right;">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${members.map(m => {
              const load = this.getMemberWorkload(m.id, allTasks, allProjects);
              return `
                <tr>
                  <td>
                    <div class="flex items-center gap-3">
                      <div class="avatar avatar-sm" style="background:${escapeHtml(m.avatarColor)};">${escapeHtml(m.avatar)}</div>
                      <span class="font-bold">${escapeHtml(m.name)}</span>
                    </div>
                  </td>
                  <td>
                    <span class="font-semibold text-xs">${escapeHtml(m.role)}</span>
                    <span class="badge badge-teal" style="margin-left:6px;">${escapeHtml(m.department || 'Engineering')}</span>
                  </td>
                  <td class="text-xs text-secondary">${escapeHtml(m.email)}</td>
                  <td class="text-xs font-semibold">${load.assignedProjects.length} Projects</td>
                  <td class="text-xs font-semibold">${load.activeTasks} Pending (${load.completedTasks} Done)</td>
                  <td style="min-width:150px;">
                    <div class="flex items-center gap-2">
                      <div class="progress-track" style="flex:1;">
                        <div class="progress-fill" style="width:${load.utilizationPct}%;"></div>
                      </div>
                      <span class="text-xs font-bold">${load.utilizationPct}%</span>
                    </div>
                  </td>
                  <td style="text-align:right;">
                    <div class="flex items-center gap-2" style="justify-content:flex-end;">
                      <button type="button" class="btn btn-glass btn-xs" data-assign-task-to="${m.id}">+ Task</button>
                      <button type="button" class="icon-btn" data-edit-member="${m.id}" title="Edit"><i data-lucide="edit-3"></i></button>
                      <button type="button" class="icon-btn text-danger" data-delete-member="${m.id}" title="Remove"><i data-lucide="trash-2"></i></button>
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
   * Binds Team Directory Events
   */
  bindEvents(container) {
    container.querySelector('#team-add-member-btn')?.addEventListener('click', () => this.openMemberModal());
    container.querySelector('#team-empty-add-btn')?.addEventListener('click', () => this.openMemberModal());

    // Search input
    const searchInput = container.querySelector('#team-search-input');
    searchInput?.addEventListener('input', (e) => {
      this.state.searchQuery = e.target.value;
      const pos = e.target.selectionStart;
      this.render(container);
      const nextInput = container.querySelector('#team-search-input');
      if (nextInput) {
        nextInput.focus();
        nextInput.setSelectionRange(pos, pos);
      }
    });

    // Department Filter
    container.querySelector('#team-dept-filter')?.addEventListener('change', (e) => {
      this.state.departmentFilter = e.target.value;
      this.render(container);
    });

    // View Mode Toggle
    container.querySelectorAll('[data-team-view]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.state.viewMode = btn.getAttribute('data-team-view');
        this.render(container);
      });
    });

    // Copy Email
    container.querySelectorAll('[data-copy-email]').forEach(btn => {
      btn.addEventListener('click', () => {
        const email = btn.getAttribute('data-copy-email');
        navigator.clipboard?.writeText(email);
        showToast('Email Copied', `${email} copied to clipboard.`, 'success');
      });
    });

    // Assign Task to Member
    container.querySelectorAll('[data-assign-task-to]').forEach(btn => {
      btn.addEventListener('click', () => {
        const memId = btn.getAttribute('data-assign-task-to');
        TasksModule.openTaskModal({ assignedTo: memId });
      });
    });

    // View Member Tasks in Tasks View
    container.querySelectorAll('[data-view-member-tasks]').forEach(link => {
      link.addEventListener('click', () => {
        const memId = link.getAttribute('data-view-member-tasks');
        TasksModule.state.assigneeFilter = memId;
      });
    });

    // Edit Member
    container.querySelectorAll('[data-edit-member]').forEach(btn => {
      btn.addEventListener('click', () => {
        const mem = StorageService.getMemberById(btn.getAttribute('data-edit-member'));
        if (mem) this.openMemberModal(mem);
      });
    });

    // Delete Member
    container.querySelectorAll('[data-delete-member]').forEach(btn => {
      btn.addEventListener('click', () => {
        const mem = StorageService.getMemberById(btn.getAttribute('data-delete-member'));
        if (!mem) return;

        if (StorageService.getTeam().length <= 1) {
          showToast('Action Blocked', 'You must keep at least one team member in the workspace.', 'error');
          return;
        }

        confirmDialog({
          title: 'Remove Team Member?',
          message: `Remove "${mem.name}" from the workspace? Their open tasks will be reassigned to the lead account.`,
          confirmText: 'Remove Member',
          danger: true,
          onConfirm: () => {
            StorageService.deleteTeamMember(mem.id);
            showToast('Member Removed', `${mem.name} was removed from the team directory.`, 'warning');
          }
        });
      });
    });
  },

  /**
   * Opens Add / Edit Team Member Modal
   */
  openMemberModal(existingMember = null) {
    const isEdit = Boolean(existingMember && existingMember.id);
    const currentColor = existingMember?.avatarColor || '#17645F';

    openModal({
      title: isEdit ? `Edit Member: ${existingMember.name}` : 'Add New Team Member',
      bodyHtml: `
        <form id="team-member-form" class="auth-form">
          <div class="form-group">
            <label class="form-label">Full Name <span class="required-star">*</span></label>
            <input
              type="text"
              name="name"
              class="form-input"
              required
              placeholder="e.g., Sophia Lin"
              value="${escapeHtml(existingMember?.name || '')}"
            />
          </div>

          <div class="form-group">
            <label class="form-label">Work Email <span class="required-star">*</span></label>
            <input
              type="email"
              name="email"
              class="form-input"
              required
              placeholder="sophia@Nexora.io"
              value="${escapeHtml(existingMember?.email || '')}"
            />
          </div>

          <div class="form-grid-2">
            <div class="form-group">
              <label class="form-label">Job Title / Role <span class="required-star">*</span></label>
              <input
                type="text"
                name="role"
                class="form-input"
                required
                placeholder="e.g., Senior Product Designer"
                value="${escapeHtml(existingMember?.role || '')}"
              />
            </div>

            <div class="form-group">
              <label class="form-label">Department</label>
              <select name="department" class="form-select">
                ${['Product', 'Engineering', 'Design', 'QA', 'Operations'].map(dep => `
                  <option value="${dep}" ${(existingMember?.department || 'Engineering') === dep ? 'selected' : ''}>${dep}</option>
                `).join('')}
              </select>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Avatar Badge Color</label>
            <div class="color-swatch-row">
              ${AVATAR_PALETTE.map(c => `
                <label class="color-swatch-label">
                  <input type="radio" name="avatarColor" value="${c.hex}" ${currentColor === c.hex ? 'checked' : ''} />
                  <span style="width:14px;height:14px;border-radius:50%;background:${c.hex};display:inline-block;"></span>
                  <span>${c.name}</span>
                </label>
              `).join('')}
            </div>
          </div>
        </form>
      `,
      footerHtml: `
        <button type="button" class="btn btn-glass btn-sm" id="member-modal-cancel">Cancel</button>
        <button type="button" class="btn btn-primary btn-sm" id="member-modal-save">
          ${isEdit ? 'Save Changes' : 'Add Member'}
        </button>
      `,
      onRender: (bodyEl, footerEl) => {
        const form = bodyEl.querySelector('#team-member-form');
        footerEl.querySelector('#member-modal-cancel')?.addEventListener('click', closeModal);

        const handleSave = (e) => {
          if (e) e.preventDefault();
          if (!form.reportValidity()) return;

          const fd = new FormData(form);
          const payload = {
            name: fd.get('name').trim(),
            email: fd.get('email').trim(),
            role: fd.get('role').trim(),
            department: fd.get('department'),
            avatarColor: fd.get('avatarColor') || '#17645F'
          };

          if (isEdit) {
            StorageService.updateTeamMember(existingMember.id, payload);
            showToast('Member Updated', `${payload.name}'s profile has been updated.`, 'success');
          } else {
            StorageService.addTeamMember(payload);
            showToast('Member Added', `${payload.name} joined the workspace team.`, 'success');
          }
          closeModal();
        };

        form?.addEventListener('submit', handleSave);
        footerEl.querySelector('#member-modal-save')?.addEventListener('click', handleSave);
      }
    });
  }
};