/* ==========================================================================
   Nexora - LINEAR-STYLE COMMAND PALETTE & GLOBAL SEARCH (js/search.js)
   Features: Instant Action Commands, ↑/↓/Enter Keyboard Navigation,
   Category/Priority/Status/Date Filters, and Search across Projects/Tasks/Team
   ========================================================================== */

import { StorageService } from './storage.js';
import { TasksModule } from './tasks.js';
import { ProjectsModule } from './projects.js';
import { TeamModule } from './team.js';
import { PwaModule } from './pwa.js';
import {
  escapeHtml,
  formatDate,
  isOverdue,
  getPriorityBadgeClass,
  getStatusBadgeClass,
  openModal,
  closeModal,
  refreshIcons
} from './utils.js';

const SUGGESTIONS = ['> New Task', '> Switch Theme', 'Urgent', 'Overdue'];
const PRIORITY_RANK = { Urgent: 4, High: 3, Medium: 2, Low: 1 };

function buildCommandRegistry() {
  const cmds = [
    {
      id: 'cmd_new_task',
      title: 'Create New Task',
      subtitle: 'Add a task with subtasks, labels, and deadline',
      icon: 'plus-circle',
      shortcut: 'N',
      keywords: 'add task todo deliverable new',
      run: () => TasksModule.openTaskModal()
    },
    {
      id: 'cmd_new_project',
      title: 'Create New Project',
      subtitle: 'Start a new project with team members and progress tracking',
      icon: 'folder-plus',
      shortcut: 'P',
      keywords: 'add project workspace initiative new',
      run: () => ProjectsModule.openProjectModal()
    },
    {
      id: 'cmd_toggle_theme',
      title: 'Toggle Light / Dark Glass Theme',
      subtitle: 'Switch between Warm Ivory Glass and Obsidian Teal Dark Mode',
      icon: 'palette',
      shortcut: 'T',
      keywords: 'theme dark light mode appearance color',
      run: () => window.dispatchEvent(new CustomEvent('Nexora:command', { detail: { action: 'toggleTheme' } }))
    },
    {
      id: 'cmd_go_dashboard',
      title: 'Go to Dashboard',
      subtitle: 'View executive KPIs, velocity charts, and activity feed',
      icon: 'layout-dashboard',
      shortcut: 'G D',
      keywords: 'home overview dashboard kpi',
      run: () => { window.location.hash = '#dashboard'; }
    },
    {
      id: 'cmd_go_kanban',
      title: 'Go to Kanban Board',
      subtitle: 'Open drag-and-drop workflow columns',
      icon: 'columns-3',
      shortcut: 'G K',
      keywords: 'board kanban drag drop columns',
      run: () => { window.location.hash = '#kanban'; }
    },
    {
      id: 'cmd_go_calendar',
      title: 'Go to Calendar',
      subtitle: 'View Monthly, Weekly, and Daily schedules',
      icon: 'calendar-days',
      shortcut: 'G C',
      keywords: 'calendar schedule deadlines month week day',
      run: () => { window.location.hash = '#calendar'; }
    },
    {
      id: 'cmd_go_analytics',
      title: 'Go to Analytics & CSV Export',
      subtitle: 'Open Chart.js productivity reports and export CSV',
      icon: 'bar-chart-3',
      shortcut: 'G A',
      keywords: 'analytics charts report csv export',
      run: () => { window.location.hash = '#analytics'; }
    },
    {
      id: 'cmd_export_csv',
      title: 'Export Full Workspace CSV Report',
      subtitle: 'Download projects, tasks, and team workload spreadsheet',
      icon: 'file-spreadsheet',
      shortcut: 'CSV',
      keywords: 'download export csv report excel spreadsheet',
      run: () => window.dispatchEvent(new CustomEvent('Nexora:command', { detail: { action: 'exportCsv' } }))
    },
    {
      id: 'cmd_replay_tour',
      title: 'Replay Interactive Tutorial',
      subtitle: 'Walk through all Nexora features step by step',
      icon: 'compass',
      shortcut: 'Tour',
      keywords: 'help guide tutorial onboarding walkthrough',
      run: () => window.dispatchEvent(new CustomEvent('Nexora:command', { detail: { action: 'replayTour' } }))
    },
    {
      id: 'cmd_shortcuts',
      title: 'View Keyboard Shortcuts Cheat Sheet',
      subtitle: 'See all single-key actions and G+key navigation chords',
      icon: 'keyboard',
      shortcut: '?',
      keywords: 'keyboard shortcuts hotkeys keys help',
      run: () => window.dispatchEvent(new CustomEvent('Nexora:command', { detail: { action: 'openShortcuts' } }))
    }
  ];

  if (!PwaModule.isInstalled) {
    cmds.push({
      id: 'cmd_install_pwa',
      title: 'Install Nexora App (Offline PWA)',
      subtitle: 'Install Nexora as a standalone desktop or mobile app',
      icon: 'download-cloud',
      shortcut: 'PWA',
      keywords: 'install app pwa offline desktop mobile',
      run: () => PwaModule.promptInstall()
    });
  }

  return cmds;
}

export const SearchModule = {
  state: {
    query: '',
    category: 'all',      // 'all' | 'commands' | 'projects' | 'tasks' | 'team'
    priority: 'All',
    status: 'All',
    dateFilter: 'All',
    sortBy: 'relevance',
    activeIndex: 0
  },

  renderedItems: [],

  openGlobalSearchModal() {
    this.state.activeIndex = 0;

    openModal({
      title: 'Command Palette & Workspace Search',
      bodyHtml: `
        <div class="search-modal-box">
          <!-- Command / Search Input -->
          <div class="input-wrapper">
            <i data-lucide="terminal" class="input-icon"></i>
            <input
              type="search"
              id="global-search-modal-input"
              class="form-input has-icon"
              placeholder="Type a command (e.g. > New Task) or search projects, tasks, team..."
              value="${escapeHtml(this.state.query)}"
              autocomplete="off"
              autofocus
            />
          </div>

          <!-- Quick Suggestions & Keyboard Hint -->
          <div class="flex justify-between items-center" style="flex-wrap:wrap;gap:8px;">
            <div class="search-suggestions-row">
              <span class="text-xs font-semibold text-muted">Try:</span>
              ${SUGGESTIONS.map(sug => `
                <button type="button" class="search-suggestion-chip" data-search-suggest="${escapeHtml(sug)}">
                  ${escapeHtml(sug)}
                </button>
              `).join('')}
            </div>
            <span class="text-xs text-muted">
              <kbd class="kbd-key">↑</kbd> <kbd class="kbd-key">↓</kbd> navigate • <kbd class="kbd-key">Enter</kbd> select
            </span>
          </div>

          <!-- Category Tabs -->
          <div class="status-tabs" style="margin-bottom:0;">
            ${[
              { key: 'all', label: 'All' },
              { key: 'commands', label: 'Commands' },
              { key: 'projects', label: 'Projects' },
              { key: 'tasks', label: 'Tasks' },
              { key: 'team', label: 'Team' }
            ].map(cat => `
              <button
                type="button"
                class="status-tab ${this.state.category === cat.key ? 'active' : ''}"
                data-search-cat="${cat.key}"
              >
                ${cat.label}
              </button>
            `).join('')}
          </div>

          <!-- Multi-Facet Filter Bar -->
          <div class="search-filters-grid">
            <select id="global-search-priority" class="filter-select" aria-label="Priority Filter">
              <option value="All">All Priorities</option>
              <option value="Urgent">Urgent</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>

            <select id="global-search-status" class="filter-select" aria-label="Status Filter">
              <option value="All">All Statuses</option>
              <option value="open">Open / Active</option>
              <option value="completed">Completed</option>
            </select>

            <select id="global-search-date" class="filter-select" aria-label="Date Filter">
              <option value="All">All Dates</option>
              <option value="overdue">Overdue Only</option>
              <option value="next7">Due Next 7 Days</option>
            </select>

            <select id="global-search-sort" class="filter-select" aria-label="Sort Results">
              <option value="relevance">Sort: Relevance</option>
              <option value="dueDate">Sort: Due Date</option>
              <option value="priority">Sort: Priority</option>
              <option value="alpha">Sort: A–Z</option>
            </select>
          </div>

          <!-- Dynamic Results & Commands List -->
          <div id="global-search-results-list" class="search-results-container"></div>
        </div>
      `,
      footerHtml: `
        <button type="button" class="btn btn-glass btn-sm" id="global-search-shortcuts-btn">
          <i data-lucide="keyboard"></i> All Shortcuts (?)
        </button>
        <div class="flex items-center gap-2" style="margin-left:auto;">
          <button type="button" class="btn btn-glass btn-sm" id="global-search-reset-btn">Reset</button>
          <button type="button" class="btn btn-primary btn-sm" id="global-search-close-btn">Close</button>
        </div>
      `,
      onRender: (bodyEl, footerEl) => {
        const input = bodyEl.querySelector('#global-search-modal-input');
        const prioSel = bodyEl.querySelector('#global-search-priority');
        const statusSel = bodyEl.querySelector('#global-search-status');
        const dateSel = bodyEl.querySelector('#global-search-date');
        const sortSel = bodyEl.querySelector('#global-search-sort');
        const resultsListEl = bodyEl.querySelector('#global-search-results-list');

        prioSel.value = this.state.priority;
        statusSel.value = this.state.status;
        dateSel.value = this.state.dateFilter;
        sortSel.value = this.state.sortBy;

        const updateResults = () => {
          this.state.activeIndex = 0;
          this.renderSearchResults(resultsListEl);
        };

        input?.addEventListener('input', (e) => {
          this.state.query = e.target.value;
          updateResults();
        });

        // Keyboard Navigation inside Command Palette (ArrowUp / ArrowDown / Enter)
        input?.addEventListener('keydown', (e) => {
          const total = this.renderedItems.length;
          if (total === 0) return;

          if (e.key === 'ArrowDown') {
            e.preventDefault();
            this.state.activeIndex = (this.state.activeIndex + 1) % total;
            this.highlightActiveItem(resultsListEl);
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            this.state.activeIndex = (this.state.activeIndex - 1 + total) % total;
            this.highlightActiveItem(resultsListEl);
          } else if (e.key === 'Enter') {
            e.preventDefault();
            const chosen = this.renderedItems[this.state.activeIndex];
            if (chosen && typeof chosen.execute === 'function') {
              chosen.execute();
            }
          }
        });

        bodyEl.querySelectorAll('[data-search-suggest]').forEach(chip => {
          chip.addEventListener('click', () => {
            const term = chip.getAttribute('data-search-suggest');
            if (term === 'Overdue') {
              this.state.dateFilter = 'overdue';
              dateSel.value = 'overdue';
            } else if (term === 'Urgent') {
              this.state.priority = 'Urgent';
              prioSel.value = 'Urgent';
            } else {
              this.state.query = term;
              if (input) input.value = term;
            }
            updateResults();
            input?.focus();
          });
        });

        bodyEl.querySelectorAll('[data-search-cat]').forEach(btn => {
          btn.addEventListener('click', () => {
            this.state.category = btn.getAttribute('data-search-cat');
            bodyEl.querySelectorAll('[data-search-cat]').forEach(b => {
              b.classList.toggle('active', b.getAttribute('data-search-cat') === this.state.category);
            });
            updateResults();
          });
        });

        prioSel?.addEventListener('change', (e) => { this.state.priority = e.target.value; updateResults(); });
        statusSel?.addEventListener('change', (e) => { this.state.status = e.target.value; updateResults(); });
        dateSel?.addEventListener('change', (e) => { this.state.dateFilter = e.target.value; updateResults(); });
        sortSel?.addEventListener('change', (e) => { this.state.sortBy = e.target.value; updateResults(); });

        footerEl.querySelector('#global-search-shortcuts-btn')?.addEventListener('click', () => {
          closeModal();
          window.dispatchEvent(new CustomEvent('Nexora:command', { detail: { action: 'openShortcuts' } }));
        });

        footerEl.querySelector('#global-search-reset-btn')?.addEventListener('click', () => {
          this.state = {
            query: '',
            category: 'all',
            priority: 'All',
            status: 'All',
            dateFilter: 'All',
            sortBy: 'relevance',
            activeIndex: 0
          };
          if (input) input.value = '';
          prioSel.value = 'All';
          statusSel.value = 'All';
          dateSel.value = 'All';
          sortSel.value = 'relevance';
          bodyEl.querySelectorAll('[data-search-cat]').forEach(b => {
            b.classList.toggle('active', b.getAttribute('data-search-cat') === 'all');
          });
          updateResults();
          input?.focus();
        });

        footerEl.querySelector('#global-search-close-btn')?.addEventListener('click', closeModal);

        updateResults();
        setTimeout(() => input?.focus(), 40);
      }
    });
  },

  highlightActiveItem(resultsEl) {
    if (!resultsEl) return;
    const nodes = resultsEl.querySelectorAll('[data-palette-idx]');
    nodes.forEach(node => {
      const idx = Number(node.getAttribute('data-palette-idx'));
      const isSelected = idx === this.state.activeIndex;
      node.classList.toggle('palette-active', isSelected);
      if (isSelected) {
        node.scrollIntoView({ block: 'nearest' });
      }
    });
  },

  renderSearchResults(resultsEl) {
    if (!resultsEl) return;

    const rawQ = this.state.query.trim();
    const isCommandPrefix = rawQ.startsWith('>');
    const q = (isCommandPrefix ? rawQ.slice(1) : rawQ).toLowerCase().trim();
    const settings = StorageService.getSettings();
    const dateFmt = settings.dateFormat || 'MMM DD, YYYY';

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const next7 = new Date(today);
    next7.setDate(today.getDate() + 7);

    const matchesDateFilter = (dueDateStr, status) => {
      if (this.state.dateFilter === 'All') return true;
      if (this.state.dateFilter === 'overdue') return isOverdue(dueDateStr, status);
      if (this.state.dateFilter === 'next7') {
        if (!dueDateStr || status === 'Completed') return false;
        const d = new Date(dueDateStr);
        return d >= today && d <= next7;
      }
      return true;
    };

    const matchesStatusFilter = (status) => {
      if (this.state.status === 'All') return true;
      if (this.state.status === 'completed') return status === 'Completed';
      return status !== 'Completed';
    };

    const hasFacetFilter =
      this.state.priority !== 'All' ||
      this.state.status !== 'All' ||
      this.state.dateFilter !== 'All';

    // 1. Commands
    const allCommands = buildCommandRegistry();
    const commands = (!hasFacetFilter || this.state.category === 'commands')
      ? allCommands.filter(cmd =>
          !q ||
          cmd.title.toLowerCase().includes(q) ||
          cmd.subtitle.toLowerCase().includes(q) ||
          cmd.keywords.includes(q)
        )
      : [];

    // 2. Projects
    let projects = isCommandPrefix ? [] : StorageService.getProjects().filter(p => !p.archived).filter(p => {
      const textMatch = !q || p.name.toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q);
      const prioMatch = this.state.priority === 'All' || p.priority === this.state.priority;
      return textMatch && prioMatch && matchesStatusFilter(p.status) && matchesDateFilter(p.dueDate, p.status);
    });

    // 3. Tasks
    let tasks = isCommandPrefix ? [] : StorageService.getTasks().filter(t => {
      const textMatch =
        !q ||
        t.title.toLowerCase().includes(q) ||
        (t.description || '').toLowerCase().includes(q) ||
        (t.labels || []).some(lbl => lbl.toLowerCase().includes(q));
      const prioMatch = this.state.priority === 'All' || t.priority === this.state.priority;
      return textMatch && prioMatch && matchesStatusFilter(t.status) && matchesDateFilter(t.dueDate, t.status);
    });

    // 4. Team Members
    let team = (isCommandPrefix || hasFacetFilter) ? [] : StorageService.getTeam().filter(m =>
      !q ||
      m.name.toLowerCase().includes(q) ||
      m.role.toLowerCase().includes(q) ||
      m.email.toLowerCase().includes(q)
    );

    const sortItems = (arr, nameKey) => arr.sort((a, b) => {
      if (this.state.sortBy === 'alpha') return String(a[nameKey]).localeCompare(String(b[nameKey]));
      if (this.state.sortBy === 'priority') return (PRIORITY_RANK[b.priority] || 0) - (PRIORITY_RANK[a.priority] || 0);
      if (this.state.sortBy === 'dueDate') return new Date(a.dueDate || '2099-12-31') - new Date(b.dueDate || '2099-12-31');
      return 0;
    });

    projects = sortItems(projects, 'name');
    tasks = sortItems(tasks, 'title');
    team = sortItems(team, 'name');

    const showCommands = this.state.category === 'all' || this.state.category === 'commands';
    const showProjects = !isCommandPrefix && (this.state.category === 'all' || this.state.category === 'projects');
    const showTasks = !isCommandPrefix && (this.state.category === 'all' || this.state.category === 'tasks');
    const showTeam = !isCommandPrefix && (this.state.category === 'all' || this.state.category === 'team');

    this.renderedItems = [];
    let html = '';

    // Build Commands Section
    if (showCommands && commands.length > 0) {
      const displayCmds = this.state.category === 'commands' || isCommandPrefix || q ? commands : commands.slice(0, 5);
      html += `<div><p class="search-result-group-title">Quick Commands (${displayCmds.length})</p><div style="display:flex;flex-direction:column;gap:6px;">`;
      displayCmds.forEach(cmd => {
        const idx = this.renderedItems.length;
        this.renderedItems.push({
          execute: () => {
            closeModal();
            setTimeout(() => cmd.run(), 40);
          }
        });
        html += `
          <div class="search-result-item ${idx === this.state.activeIndex ? 'palette-active' : ''}" data-palette-idx="${idx}">
            <div class="flex items-center gap-3" style="min-width:0;">
              <div class="kpi-icon teal" style="width:30px;height:30px;flex-shrink:0;">
                <i data-lucide="${cmd.icon}" style="width:15px;height:15px;"></i>
              </div>
              <div style="min-width:0;">
                <p class="font-bold text-sm">${escapeHtml(cmd.title)}</p>
                <p class="text-xs text-secondary">${escapeHtml(cmd.subtitle)}</p>
              </div>
            </div>
            <kbd class="kbd-key">${escapeHtml(cmd.shortcut)}</kbd>
          </div>
        `;
      });
      html += `</div></div>`;
    }

    // Build Projects Section
    if (showProjects && projects.length > 0) {
      html += `<div><p class="search-result-group-title">Projects (${projects.length})</p><div style="display:flex;flex-direction:column;gap:6px;">`;
      projects.forEach(p => {
        const idx = this.renderedItems.length;
        this.renderedItems.push({
          execute: () => {
            closeModal();
            window.location.hash = `#project-details?id=${p.id}`;
          }
        });
        html += `
          <div class="search-result-item ${idx === this.state.activeIndex ? 'palette-active' : ''}" data-palette-idx="${idx}">
            <div>
              <p class="font-bold text-sm">${escapeHtml(p.name)}</p>
              <p class="text-xs text-secondary">Due ${formatDate(p.dueDate, dateFmt)} • ${p.progress}% Complete</p>
            </div>
            <div class="flex items-center gap-2">
              <span class="badge ${getStatusBadgeClass(p.status)}">${escapeHtml(p.status)}</span>
              <span class="badge ${getPriorityBadgeClass(p.priority)}">${escapeHtml(p.priority)}</span>
            </div>
          </div>
        `;
      });
      html += `</div></div>`;
    }

    // Build Tasks Section
    if (showTasks && tasks.length > 0) {
      html += `<div><p class="search-result-group-title">Tasks (${tasks.length})</p><div style="display:flex;flex-direction:column;gap:6px;">`;
      tasks.forEach(t => {
        const idx = this.renderedItems.length;
        const overdue = isOverdue(t.dueDate, t.status);
        this.renderedItems.push({
          execute: () => {
            closeModal();
            window.location.hash = '#tasks';
            setTimeout(() => TasksModule.openTaskDetailModal(t.id), 60);
          }
        });
        html += `
          <div class="search-result-item ${idx === this.state.activeIndex ? 'palette-active' : ''}" data-palette-idx="${idx}">
            <div>
              <p class="font-bold text-sm">${escapeHtml(t.title)}</p>
              <p class="text-xs ${overdue ? 'text-danger font-semibold' : 'text-secondary'}">
                ${overdue ? 'Overdue: ' : 'Due '}${formatDate(t.dueDate, dateFmt)} • ${escapeHtml(t.status)}
              </p>
            </div>
            <span class="badge ${getPriorityBadgeClass(t.priority)}">${escapeHtml(t.priority)}</span>
          </div>
        `;
      });
      html += `</div></div>`;
    }

    // Build Team Section
    if (showTeam && team.length > 0) {
      html += `<div><p class="search-result-group-title">Team Members (${team.length})</p><div style="display:flex;flex-direction:column;gap:6px;">`;
      team.forEach(m => {
        const idx = this.renderedItems.length;
        this.renderedItems.push({
          execute: () => {
            closeModal();
            TeamModule.state.searchQuery = m.name;
            window.location.hash = '#team';
          }
        });
        html += `
          <div class="search-result-item ${idx === this.state.activeIndex ? 'palette-active' : ''}" data-palette-idx="${idx}">
            <div class="flex items-center gap-3">
              <div class="avatar avatar-sm" style="background:${escapeHtml(m.avatarColor)};">${escapeHtml(m.avatar)}</div>
              <div>
                <p class="font-bold text-sm">${escapeHtml(m.name)}</p>
                <p class="text-xs text-secondary">${escapeHtml(m.role)} • ${escapeHtml(m.email)}</p>
              </div>
            </div>
            <span class="badge badge-teal">${escapeHtml(m.department || 'Team')}</span>
          </div>
        `;
      });
      html += `</div></div>`;
    }

    if (this.renderedItems.length === 0) {
      resultsEl.innerHTML = `
        <div class="empty-state" style="padding:var(--space-6);">
          <p class="text-sm font-semibold">No matching commands or workspace items</p>
          <p class="text-xs text-secondary">Try typing <code>&gt; New Task</code> or clearing your filters.</p>
        </div>
      `;
      return;
    }

    resultsEl.innerHTML = html;

    // Bind Mouse Hover & Click Selection
    resultsEl.querySelectorAll('[data-palette-idx]').forEach(el => {
      const idx = Number(el.getAttribute('data-palette-idx'));
      el.addEventListener('mouseenter', () => {
        this.state.activeIndex = idx;
        this.highlightActiveItem(resultsEl);
      });
      el.addEventListener('click', () => {
        const item = this.renderedItems[idx];
        if (item && typeof item.execute === 'function') item.execute();
      });
    });

    refreshIcons();
  }
};